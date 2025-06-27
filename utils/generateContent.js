require('dotenv').config()
const API_KEY = process.env.AI_API_KEY;

const fs = require('fs');
const path = require('path');
const logFolderCode = path.join(__dirname, 'gemini_folder_log.txt');
const logServerCode = path.join(__dirname, 'gemini_server_log.txt');

/**
 * Generates content for a specific file in a Node.js + Express project.
 * @param {string} folderName - The name of the file or folder to generate content for.
 * @param {string} [userPrompt] - Optional user-provided prompt to customize the content generation.
 * @returns {Promise<string>} - The generated content as a string.
 */
async function generateFileContent(folderName, fileType, dependency = {}) {
    const language = fileType === 'ts' ? 'TypeScript' : 'JavaScript';
    const depUsage = Object.entries(dependency)
        .map(([pkg]) => `- ${pkg}`)
        .join('\n');

    try {
        const prompt = `
        🧠 Think carefully before writing any code.

        Generate only valid ${language} code for the "${folderName}" file in a modular Express.js + Mongoose project.

        🗂️ Folder: "${folderName}"
        📦 Use ONLY the following dependencies (import them appropriately):
        ${depUsage}

        📌 ${getFolderSpecificHint(folderName)}

        ❗ Important Rules:
        - Only generate code relevant to the "${folderName}" file.
        - Do NOT include code from any other folder or responsibility.
        - Use async/await, proper error handling.
        - Output raw ${language} code ONLY — no markdown, no backticks, no descriptions, no comments.

        `.trim();

        const data = await getAIGeneratedData(prompt, fileType);

        if (process.env.NODE_ENV?.trim() === 'development') {
            const logEntry = `----- ${folderName.toUpperCase()} -----\n${data} \n`;
            fs.appendFile(logFolderCode, logEntry, (err) => {
                if (err) console.error('Error writing to log file:', err);
                else console.log(`AI result appended for folder files`);
            });
        }

        return data;

    } catch (err) {
        console.error(`Error generating content for ${folderName}: `, err);
    }
}

/**
 * @param {string} folderName
 * @param {string} fileType - The file type (e.g., 'ts' for TypeScript, 'js' for JavaScript).
 * @returns {string} - A hint specific to the given folder name.
 */
function getFolderSpecificHint(folderName, fileType) {
    switch (folderName) {
        case "controllers":
            return `Export the following async controller functions using '../models/User': getAllUsers, getUserById, createUser, updateUser, deleteUser.`.trim();

        case "models":
            return `Export a Mongoose ${fileType === 'ts' ? 'interface and model' : 'model'} for User with fields: name (String, required), email (String, required, unique), password (String, required), createdAt (Date, default: now).`.trim();

        case "routes":
            return `Create an Express Router. Import functions from '../controllers'. Map routes: GET '/', GET '/:id', POST '/', PATCH '/:id', DELETE '/:id'. Export the router.`.trim();

        case "middlewares":
            return `Export: 1. logger — logs req.method and req.url. 2. errorHandler — returns status and error message.`.trim();

        case "config":
            return `Export an async function to connect to MongoDB using mongoose.connect. Use process.env.MONGO_URI for URI.`.trim();

        case "utils":
            return `Export a catchAsync utility: a function that wraps async Express handlers and passes errors to next().`.trim();

        case "services":
            return `Export functions to interact with the User model: getAllUsers, getUserById, createUser, updateUser, deleteUser. Use ../models/User. Do not handle HTTP here.`.trim();

        default:
            return `Return a minimal valid ${fileType === 'ts' ? 'TypeScript' : 'JavaScript'} file for "${folderName}".`.trim();
    }
}

/**
 * @param {string} language - JS/TS 
 * @param {number} port - The port number for the server.
 * @param {object} dependencies - The dependencies to include in the generated code.
 * @returns - The generated server code as a string.
 */
async function generateServerCode(language = "js", port = 3000, dependencies = {}) {
    const langText = language === "ts" ? "TypeScript" : "JavaScript";
    const typeHint = language === "ts"
        ? `Use Express with TypeScript types (e.g., Request, Response from 'express').`
        : `Use standard CommonJS syntax (require, module.exports).`;

    const depUsage = Object.entries(dependencies)
        .map(([pkg]) => `- ${pkg}`)
        .join('\n');

    const prompt = `
    You are a smart code generator.


    Generate a minimal ${langText} Express server file (server.${language}) using only the following dependencies: ${depUsage}

    Instructions:
    - Import all required dependencies properly.
    - It should start an Express app on port ${port}.
    - Set up middleware: express.json() and express.urlencoded({ extended: true }).
    - Add a GET "/" route that responds with "Server is running on port ${port}".
    - Log the server URL when listening.
    - ${typeHint}
    - Do NOT include markdown, code fences, comments, or any other description.
    - Output only valid raw ${langText} code, nothing else.
    `.trim();

    const data = await getAIGeneratedData(prompt);


    if (process.env.NODE_ENV?.trim() === 'development') {
        const logEntry = `----- ${language.toUpperCase()} -----\n${data} \n`;
        fs.appendFile(logServerCode, logEntry, (err) => {
            if (err) console.error('Error writing to log file:', err);
            else console.log(`AI result appended for server files`);
        });
    }

    return data;
}


/**
 * @param {string} prompt - The prompt for the AI model.
 * @returns - The AI-generated code as a string.
 */
async function getAIGeneratedData(prompt) {
    try {
        const response = await fetch('https://api.together.xyz/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free', // Free OSS model
                messages: [
                    { role: 'system', content: 'You are a helpful coding assistant.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 2048
            })
        });

        if (!response.ok) {
            const err = await response.json();
            console.error('Together API error:', err);
            return '// Error from Together API';
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        const cleanCode = content
            .replace(/```(javascript|typescript)?/gi, '')
            .replace(/```/g, '')
            .trim();

        return cleanCode.trim() || '// No code generated';
    } catch (error) {
        console.error("Error generating AI-generated data:", error);
    }
}



module.exports = { generateFileContent, generateServerCode };






