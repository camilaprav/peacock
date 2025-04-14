let isBrowser = typeof window !== 'undefined';

class PeacockError extends Error {
  constructor(status, message) {
    super(typeof message === 'string' ? message : JSON.stringify(message));
    this.status = status;
    this.body = message;
  }
}

async function ensureDir(dir) {
  if (typeof mkdirp === 'function') await mkdirp(dir);
}

async function makePeacock({ storage = 'storage' } = {}) {
  let dbStorage = `${storage}/db`;
  let uploadStorage = `${storage}/uploads`;
  let datastores = new Map();
  let hookRegistry = new Map();

  await ensureDir(dbStorage);
  await ensureDir(uploadStorage);

  async function middleware(req, res, next) {
    if (isBrowser && req.protocol !== 'peacock') return next?.();

    try {
      if (req.method === 'POST' && req.url.startsWith('/upload')) {
        return await handleUpload(req, res);
      }

      if (req.url.startsWith('/uploads/')) {
        return await handleFileFetch(req, res);
      }

      if (req.url.startsWith('/db/')) {
        let handled = await handleDatabaseRequest(req, res);
        if (handled) return handled;
      }

      return next?.();
    } catch (err) {
      return handleError(err, res);
    }
  }

  middleware.hooks = (path, { around, before, after }) => {
    let current = hookRegistry.get(path) || {};
    hookRegistry.set(path, {
      around: around || current.around,
      before: before || current.before,
      after: after || current.after,
    });
  };

  async function handleUpload(req, res) {
    let id = crypto.randomUUID();
    let dir = uploadStorage;
    let storagePath = `${dir}/${id}`;
    let filename;

    if (!isBrowser) {
      await mkdirp(dir);
      let busboy = Busboy({ headers: req.headers });
      let fileHandle = await fsp.open(storagePath, 'w');
      req.pipe(busboy);

      await new Promise((resolve, reject) => {
        busboy.on('file', (_field, file, { filename: incomingName }) => {
          filename = incomingName;
          file.on('data', chunk => fileHandle.write(chunk));
          file.on('end', () => fileHandle.close());
        });
        busboy.on('finish', resolve);
        busboy.on('error', reject);
      });
    } else {
      let file = req.body?.get?.('file');
      if (!(file instanceof Blob)) return res.status(400).send('Invalid file');
      filename = file.name;
      await lf.setItem(`peacock:${storagePath}`, file);
    }

    let slug = filename.replace(/[^\w]+/g, '-').toLowerCase();
    let url = `/uploads/${id}/${slug}`;
    return res.json({ id, url });
  }

  async function handleFileFetch(req, res) {
    let parts = req.url.split('/');
    if (parts.length < 3) return;

    let [, , id] = parts;
    let filePath = `${uploadStorage}/${id}`;

    if (isBrowser) {
      let file = await lf.getItem(`peacock:${filePath}`);
      if (!file) return res.status(404).send('File not found');
      res.setHeader('Content-Type', file.type || 'application/octet-stream');
      let reader = file.stream().getReader();
      while (true) {
        let { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      return res.end();
    }

    try {
      let stat = await fsp.stat(filePath);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Type', 'application/octet-stream');
      let stream = fs.createReadStream(filePath);
      stream.pipe(res);

      return await new Promise((resolve, reject) => {
        stream.on('error', err => {
          res.statusCode = 500;
          res.end('Internal Server Error');
          reject(err);
        });
        stream.on('end', resolve);
      });
    } catch {
      return res.status(404).send('File not found');
    }
  }

  async function handleDatabaseRequest(req, res) {
    let [, , namespace, collection, maybeId] = req.url.split('/');
    if (!namespace || !collection) return false;

    let key = `${namespace}/${collection}`;
    let filename = `${dbStorage}/${key}.db`;

    if (!datastores.has(key)) {
      datastores.set(key, new Datastore({ filename, autoload: true }));
    }

    let ds = datastores.get(key);
    let method = getMethod(req.method, maybeId);
    if (!method) return res.status(405).send('Method not allowed');

    let ctx = {
      method,
      id: maybeId || null,
      params: req.query,
      data: req.body,
      result: undefined,
      req,
      res,
    };

    let hooks = hookRegistry.get(key) || {};
    for (let hook of hooks.around || []) await hook(ctx);
    for (let hook of hooks.before || []) await hook(ctx);

    if (method === 'get') {
      let result = await ds.findOneAsync({ _id: ctx.id });
      if (!result) return res.status(404).send('Not found');
      ctx.result = result;
    } else if (method === 'find') {
      ctx.result = await ds.findAsync(ctx.params);
    } else if (method === 'create') {
      ctx.result = await ds.insertAsync(ctx.data);
    } else if (method === 'update') {
      ctx.result = {
        updated: await ds.updateAsync({ _id: ctx.data._id }, ctx.data, {}),
      };
    } else if (method === 'remove') {
      if (!ctx.params || Object.keys(ctx.params).length === 0) {
        return res
          .status(400)
          .send('Refusing to delete entire collection without a query.');
      }
      ctx.result = {
        deleted: await ds.removeAsync(ctx.params, { multi: true }),
      };
    }

    for (let hook of hooks.after || []) await hook(ctx);
    for (let hook of hooks.around || []) await hook(ctx);

    return res.json(ctx.result);
  }

  function getMethod(method, id) {
    if (method === 'GET') return id ? 'get' : 'find';
    if (method === 'POST') return 'create';
    if (method === 'PUT') return 'update';
    if (method === 'DELETE') return 'remove';
    return null;
  }

  function handleError(err, res) {
    if (err instanceof PeacockError) {
      let status = err.status || 500;
      let body = err.body;
      return typeof body === 'object'
        ? res.status(status).json(body)
        : res.status(status).send(String(body));
    }

    console.error(err);
    res.status(500).send(err.message);
  }

  return middleware;
}

export default await makePeacock({ storage: 'storage' });
export { PeacockError, makePeacock };
