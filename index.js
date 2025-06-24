const express = require("express");
const cors = require("cors");
const Joi = require("joi"); // for validation
const helmet = require("helmet");
const path = require("path");
const app = express();
const generateProjectZip = require("./utils/generateProjectFiles");
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
        "https://img.icons8.com",
        "'unsafe-inline'"
      ],
      "img-src": ["'self'", "data:", "https://img.icons8.com"],
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
      port: Joi.number().optional(),
      folderStructure: Joi.string().valid("basic", "mvc", "modular").optional(),
      isTypescriptSelected: Joi.boolean().optional(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });

    }

    await generateProjectZip(res, value);

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
