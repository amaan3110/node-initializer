const express = require("express");
const cors = require("cors");
const archiver = require("archiver");
const stream = require("stream");
const Joi = require("joi"); // for validation
const helmet = require("helmet");
const path = require("path");
const app = express();
require('dotenv').config()

app.use(cors({
  origin: process.env.ORIGIN || "*",
}));

app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": [
        "'self'",
        "https://cdn.jsdelivr.net",
      ],
      "script-src-attr": ["'unsafe-inline'"],
      "style-src": [
        "'self'",
        "https://cdn.jsdelivr.net",
        "https://fonts.googleapis.com",
        "'unsafe-inline'"
      ],
      "font-src": [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdn.jsdelivr.net"
      ],
      "connect-src": ["'self'", "https://registry.npmjs.org", "https://node-initializer.onrender.com"],
    },
  })
);


app.use(express.json());


// Set EJS as view engine and point to 'views' directory
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index");
});

/**
 * @route POST /create-project
 * @desc Generates and returns a project ZIP containing package.json and server.js
 */
app.post("/create-project", async (req, res) => {
  try {
    const schema = Joi.object({
      packageJson: Joi.object().required(),
      port: Joi.number().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { packageJson, port } = value;

    const packageContent = JSON.stringify(packageJson, null, 2); // Pretty JSON

    const serverJsContent = `
      const express = require('express');
      const app = express();
      const PORT = process.env.PORT || ${port || 3000};

      app.use(express.json());
      app.use(express.urlencoded({ extended: true }));

      app.get('/', (req, res) => {
      res.send('Server is running on port ' + PORT);
      });

      app.listen(PORT, () => {
      console.log(\`Server running at http://localhost:\${PORT}\`);
      });
      `.trim();

    const readmeContent = `
      # Project Setup Instructions

      1. Install dependencies:
        \`npm install\`

      2. Start the project:
        \`npm start\`

      This project uses Express.js.

      Make sure Node.js is installed before running the above commands.
      `.trim();

    // Create in-memory ZIP
    const archive = archiver("zip", { zlib: { level: 9 } });
    const passthroughStream = new stream.PassThrough();

    res.setHeader("Content-Disposition", "attachment; filename=project.zip");
    res.setHeader("Content-Type", "application/zip");

    archive.pipe(passthroughStream);
    passthroughStream.pipe(res); // stream ZIP to client

    // Append files to archive
    archive.append(packageContent, { name: "package.json" });
    archive.append(serverJsContent, { name: packageJson.main || "server.js" });
    archive.append(readmeContent, { name: "README.txt" }); // 👈 Added guide file

    await archive.finalize(); // finish ZIP creation
  } catch (error) {
    next(error);
  }
});


// Centralized Error Handler
app.use((err, req, res, next) => {
  console.error("💥 Internal Server Error:", err);
  if (res.headersSent) return;
  res.status(500).json({ message: "Something went wrong!" });
});


app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
