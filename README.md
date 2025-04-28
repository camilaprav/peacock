# 🦚 Peacock

Peacock is a lightweight, FeathersJS-inspired middleware for Express that provides RESTful API endpoints for embedded document database operations and file uploads. It supports both Node.js and browser environments with the same core logic.

⚠️ **Work in Progress**: This project is still under active development. APIs may change, and breaking updates are possible until a stable release is published.

It is **strongly recommended to start with the browser-based version**, and only migrate to a server when it's time to actually share data between users. This helps reduce setup complexity and makes development faster and more self-contained.

Published under the super-permissive ISC license (see [License](#License)).

---

## 🚀 Features

- 🗃️ **Embedded Document Database API**  
  REST-style endpoints (`GET`, `POST`, `PUT`, `DELETE`) to interact with NeDB collections scoped by namespace. Collections are created on-demand—no need for pre-registration.

- 📁 **File Upload API**  
  Upload files via `multipart/form-data`, automatically store them under a unique URL, and support retrieval. **Note:** File uploads are stored separately and have no connection to NeDB.

- 🔄 **Pluggable Hooks**  
  Add custom middleware logic (`before`, `after`, and `around`) per collection. The hook system is designed to mimic [FeathersJS](https://feathersjs.com)'s service lifecycle hooks for familiarity and flexibility.

- 🌐 **Dual Environment Support**  
  Works in both Node.js (with Express) and browser (with localForage).

- 🧩 **Extensible Roadmap**  
  A MongoDB adapter and built-in mail sending functionality are planned for future releases.

---

## 🌍 Usage in the browser

You can use Peacock directly in the browser by importing it and adding it as a middleware to [xfetch](https://github.com/yourusername/xfetch):

```js
import xfetch from 'https://esm.sh/@camilaprav/xfetch';
import peacock from 'https://esm.sh/@camilaprav/peacock';

// Register Peacock as a middleware
xfetch.middlewares.push(peacock);
```

To target the local (in-browser) Peacock middleware, requests must be made to the `peacock://` protocol:

```js
await xfetch('peacock://browser/db/myspace/users');
await xfetch('peacock://browser/upload/myspace', { body: formData });
```

To switch to a real server implementation later, simply change your `xfetch` request URLs to standard HTTPS that points to a Peacock server:

```js
await xfetch('https://api.example.com/db/myspace/users');
```

This allows you to use the same request logic in both environments with minimal changes.

---

## 🧩 Hooks API

You can register lifecycle hooks for specific collections:

```js
peacock.hooks('myspace/users', {
  before: [
    async (ctx) => {
      if (ctx.method === 'create') {
        ctx.data.createdAt = new Date();
      }
    }
  ]
});
```

Available hook types: `around`, `before`, `after`.

The hook system mimics FeathersJS's lifecycle model, allowing you to extend and customize behavior with familiar patterns.

Each hook receives a `ctx` object:
```js
{
  method,     // One of: 'get', 'find', 'create', 'update', 'remove'
  id,         // Document ID (if applicable)
  params,     // URL query parameters
  data,       // Request body (for POST/PUT)
  result,     // The result to send back
  req,        // Raw Express request
  res         // Raw Express response
}
```

---

## 📦 Installation

```bash
git clone https://github.com/camilaprav/peacock
cd peacock
npm install
```

To build the server and browser versions:

```bash
npm run build
```

This creates:
- `peacock.server.js` – for use in Node.js environments.
- `peacock.browser.js` – for use in browser apps.

---

## 🧑‍💻 Server Usage

### Start the server

```bash
node server.js
```

### Database API

`/db/:namespace/:collection[/:id]`

Collections are created automatically upon first access—no setup required.

#### Examples

- `GET /db/myspace/users` – find documents
- `GET /db/myspace/users/:id` – get one document
- `POST /db/myspace/users` – insert document
- `PUT /db/myspace/users` – update document (by `_id`)
- `DELETE /db/myspace/users?name=John` – remove matching documents

### File Upload

`POST /upload/:namespace`  
Uploads a file under the given namespace.

#### Request

- Content-Type: `multipart/form-data`
- Form field: `file`

#### Response
```json
{
  "namespace": "myspace",
  "id": "generated-id",
  "url": "/uploads/myspace/generated-id/filename.ext"
}
```

---

## 🧪 Development Notes

- **Browser version** uses ES modules and `localForage` for simulated file storage.
- Designed to be environment-agnostic while maintaining modularity and clarity.

---

## 🧠 Inspiration

Peacock is inspired by [FeathersJS](https://feathersjs.com), but takes a more minimal and file-centric approach. It aims to be portable, environment-aware, and easy to plug into any web stack.

---

## License

### ISC (Internet Systems Consortium)

Peacock is free software: you can redistribute it and/or modify it under the terms of the [ISC License](COPYING).

## Exclusion of warranty

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
