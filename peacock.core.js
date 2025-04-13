async function ensureDir(dir) {
  if (typeof mkdirp === 'function') await mkdirp(dir);
}

class PeacockError extends Error {
  constructor(status, message) {
    super(typeof message === 'string' ? message : JSON.stringify(message));
    this.status = status;
    this.body = message;
  }
}

async function makePeacock({ storage = 'storage' } = {}) {
  const dbStorage = `${storage}/db`;
  const fileStorage = `${storage}/files`;

  await ensureDir(dbStorage);
  await ensureDir(fileStorage);

  const datastores = new Map();
  const hookRegistry = new Map();

  const middleware = async function peacock(req, res, next) {
    if (typeof window !== 'undefined' && req.protocol !== 'peacock') return next?.();

    try {
      if (typeof window !== 'undefined') {
        const parsedUrl = new URL(req.raw.input);
        const query = Object.fromEntries(parsedUrl.searchParams.entries());
        parsedUrl.pathname = `/${parsedUrl.host}${parsedUrl.pathname}`;
        req.url = parsedUrl.pathname + parsedUrl.search;
        req.query = query;
      }

      if (req.method === 'POST' && req.url.startsWith('/upload/')) {
        const uploadMatch = req.url.match(/^\/upload\/([^/?#]+)/);
        if (!uploadMatch) return res.status(400).send('Missing upload namespace');

        const namespace = uploadMatch[1];
        const id = crypto.randomUUID();
        const dir = `${fileStorage}/${namespace}`;
        const tmpPath = `${dir}/${id}`;
        let filename;

        if (globalThis.Busboy && req.headers['content-type']?.startsWith('multipart/form-data')) {
          const busboy = Busboy({ headers: req.headers });
          await mkdirp(dir);

          const fileHandle = await fs.open(tmpPath, 'w');
          req.raw.body.pipe(busboy);

          await new Promise((resolve, reject) => {
            busboy.on('file', (_fieldname, file, info) => {
              filename = info.filename;
              file.on('data', chunk => fileHandle.write(chunk));
              file.on('end', async () => {
                await fileHandle.close();
              });
            });
            busboy.on('finish', resolve);
            busboy.on('error', reject);
          });
        } else if (typeof window !== 'undefined' && req.body instanceof FormData) {
          const file = req.body.get('file');
          if (!(file instanceof Blob)) return res.status(400).send('Invalid file');
          filename = file.name;
          await lf.setItem(`peacock:${tmpPath}`, file);
        } else {
          return res.status(400).send('Unsupported environment or body type');
        }

        const slug = filename.replace(/[^\w]+/g, '-').toLowerCase();
        const url = `/files/${namespace}/${id}/${slug}`;
        return res.json({ namespace, id, url });
      }

      const match = req.url.match(/^\/db\/([^/]+)\/([^/?#]+)/);
      if (!match) return next?.();

      const [, namespace, collection] = match;
      const key = `${namespace}/${collection}`;
      const filename = `${dbStorage}/${key}.db`;

      if (!datastores.has(key)) {
        datastores.set(key, new Datastore({ filename, autoload: true }));
      }

      const ds = datastores.get(key);
      const idMatch = req.url.match(/^\/db\/[^/]+\/[^/]+\/([^/?#]+)/);
      const id = idMatch?.[1] ?? null;

      const method =
        req.method === 'GET' && id ? 'get' :
        req.method === 'GET' ? 'find' :
        req.method === 'POST' ? 'create' :
        req.method === 'PUT' ? 'update' :
        req.method === 'DELETE' ? 'remove' :
        null;

      if (!method) return res.status(405).send('Method not allowed');

      const ctx = {
        method,
        id,
        params: req.query,
        data: req.body,
        result: undefined,
        req,
        res,
      };

      const hooks = hookRegistry.get(key) || {};
      for (const hook of hooks.around || []) await hook(ctx);
      for (const hook of hooks.before || []) await hook(ctx);

      if (method === 'get') {
        ctx.result = await ds.findOneAsync({ _id: ctx.id });
        if (!ctx.result) throw new PeacockError(404, 'Not found');
      } else if (method === 'find') {
        ctx.result = await ds.findAsync(ctx.params);
      } else if (method === 'create') {
        ctx.result = await ds.insertAsync(ctx.data);
      } else if (method === 'update') {
        const updated = await ds.updateAsync({ _id: ctx.data._id }, ctx.data, {});
        ctx.result = { updated };
      } else if (method === 'remove') {
        if (!ctx.params || Object.keys(ctx.params).length === 0) {
          throw new PeacockError(400, 'Refusing to delete entire collection without a query.');
        }
        const deleted = await ds.removeAsync(ctx.params, { multi: true });
        ctx.result = { deleted };
      }

      for (const hook of hooks.after || []) await hook(ctx);
      for (const hook of hooks.around || []) await hook(ctx);

      return res.json(ctx.result);
    } catch (err) {
      if (err instanceof PeacockError) {
        const status = err.status || 500;
        const body = err.body;
        return typeof body === 'object'
          ? res.status(status).json(body)
          : res.status(status).send(String(body));
      }

      console.error(err);
      res.status(500).send(err.message);
    }
  };

  middleware.hooks = (path, { around, before, after }) => {
    const current = hookRegistry.get(path) || {};
    hookRegistry.set(path, {
      around: around || current.around,
      before: before || current.before,
      after: after || current.after,
    });
  };

  return middleware;
}

export default await makePeacock({ storage: 'storage' });
export { PeacockError, makePeacock };
