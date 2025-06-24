const stream = require("stream");
const archiver = require("archiver");
const { generateFileContent, generateServerCode } = require("./generateContent");


async function generateProjectZip(res, { packageJson, port, folderStructure, isTypescriptSelected }) {

  try {
    const dependency = packageJson.dependencies
    // Create in-memory ZIP
    const archive = archiver("zip", { zlib: { level: 9 } });
    const passthroughStream = new stream.PassThrough();

    res.setHeader("Content-Disposition", `attachment; filename=project-${Date.now()}.zip`);
    res.setHeader("Content-Type", "application/zip");

    archive.pipe(passthroughStream);
    passthroughStream.pipe(res); // stream ZIP to client

    const packageContent = JSON.stringify(packageJson, null, 2);

    const readmeContent = `
    # Project Setup Instructions

    ✅ Prerequisites:
    - Node.js (v14 or above): https://nodejs.org/
    - MongoDB (local or Atlas)

    📁 Setup Instructions:

    1. Install dependencies:
      \`npm install\`

    2. Create environment file:
      \`.env\`
      PORT=3000
      MONGO_URI=mongodb://localhost:27017/mydb

    3. Start MongoDB locally (optional):
      \`mongod\`

    4. Start the project:
      \`npm start\`

    5. For development with nodemon:
      \`npm run dev\`

    6. Visit:
      \`http://localhost:3000/\`


    📝 Notes:
    - Uncomment any placeholder code (e.g. \`// require(...)\` or \`// app.use(...)\`) if present.
    - The project uses Express.js with modular structure.

    `.trim();


    const typescriptConfigContent = `
      {
      "compilerOptions": {
        "target": "ES2020",
        "module": "commonjs",
        "strict": true,
        "rootDir": "./",
        "outDir": "./dist",
        "esModuleInterop": true,
        "skipLibCheck": true
      },
      "include": ["./**/*.ts"],
      "exclude": ["node_modules", "dist"]
      }
      `.trim();

    const ext = isTypescriptSelected ? 'ts' : 'js';
    const serverContent = await generateServerCode(ext, port, dependency)

    // Append files to archive
    archive.append(packageContent, { name: "package.json" });
    archive.append(serverContent, { name: packageJson.main || `server.${ext}` });
    archive.append(readmeContent, { name: "README.txt" });

    if (isTypescriptSelected) {
      // Add tsconfig.json if TypeScript is selected
      archive.append(typescriptConfigContent, { name: "tsconfig.json" });
    }

    // ✅ Additional files/folders for MVC & Modular structures
    const folderMap = {
      mvc: ["controllers", "models", "routes", "middlewares"],
      modular: ["controllers", "models", "routes", "middlewares", "config", "utils", "services"]
    };

    const folders = folderMap[folderStructure] || [];
    folders.forEach(async (folder) => {
      archive.append("", { name: `${folder}/.gitkeep` });
    });

    if (folders.length > 0) {
      const filesToAdd = [];

      for (const folder of folders) {
        const fileName = `${folder}/index.${ext}`;
        try {
          const content = await generateFileContent(
            folder,
            ext,
            dependency
          );
          filesToAdd.push({ name: fileName, content });
        } catch (err) {
          console.error(`Error generating ${folder}:`, err);
          filesToAdd.push({ name: fileName, content: `// Error generating ${folder}` });
        }
      }

      // Now append all files safely
      for (const file of filesToAdd) {
        archive.append(file.content, { name: file.name });
      }
    }

    return archive.finalize(); // finish ZIP creation
  } catch (error) {
    console.error("Error generating project ZIP:", error);
    res.status(500).send("Internal Server Error");
    return;

  }
}

module.exports = generateProjectZip;