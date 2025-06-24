const input = document.getElementById("dependency");
const dependencyList = document.getElementById("dependencyList");

var dep = {
    express: "latest",
};

var devDep = {
    nodemon: "latest",
}

var isTypescriptSelected = false;

document.getElementById("projectLanguage").addEventListener('click', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === "radio") {
        const entryPoint = document.getElementById("entryPoint");
        const note = document.getElementById('noteForTS')
        isTypescriptSelected = e.target.id === 'ts';
        entryPoint.value = isTypescriptSelected ? "index.ts" : "index.js";
        note.innerHTML = isTypescriptSelected ? "Type definitions are managed automatically — no need to install them manually." : ''
        if (isTypescriptSelected) {
            dep['typescript'] = 'latest';
            devDep['ts-node'] = 'latest';
            devDep['@types/node'] = 'latest';
            devDep['@types/express'] = "latest";
        } else {
            delete dep['typescript'];
            delete devDep['ts-node'];
            delete devDep['@types/node'];
            delete devDep['@types/express'];
        }
    }
})

async function fetchPackages() {
    const query = input.value;
    if (!query.trim()) return;

    try {
        const res = await fetch(
            `https://registry.npmjs.org/-/v1/search?text=${query}&size=5`
        );
        const data = await res.json();

        if (!data.objects || data.objects.length === 0) {
            dependencyList.innerHTML = "<li>No packages found</li>";
            return;
        }

        dependencyList.innerHTML = ""; // Clear previous results

        data.objects.forEach((pkg) => {
            const name = pkg.package.name;
            const description = pkg.package.description || "No description";
            const version = pkg.package.version || "latest";

            const li = document.createElement("li");
            li.addEventListener("click", async () => {

                if (dep[name] || name.startsWith('@types/')) {
                    alert(`${name} is already added.`);
                    return;
                }; // If already added, do not add again
                addDependencyToUI(name, description, version);
                dep[name] = version || 'latest'; // Store the dependency

                if (isTypescriptSelected) {
                    const needsTypes = await needsTypeDefinition(name);
                    if (needsTypes) {
                        if (devDep[`@types/${name}`]) return;
                        devDep[`@types/${name}`] = "latest";
                    }
                }

            });
            li.className = "border-bottom p-1 py-2 dependency-item";
            li.innerHTML = `
              <p style="font-weight: bold; margin: 0;">${name} - ${version}</p>
              <span style="font-size: 0.9em; color: #666;">${description}</span>
          `;

            dependencyList.appendChild(li);
        });
    } catch (err) {
        console.error("Error fetching packages:", err);
    }
}

input.addEventListener("input", _.debounce(fetchPackages, 500));

const dependencyContainer = document.getElementById(
    "dependencyContainer"
);

function addDependencyToUI() {
    const args = Array.from(arguments);
    const name = args[0];
    const description = args[1] || "No description available";
    const version = args[2] || "latest";
    const div = document.createElement("div");
    div.className =
        "d-flex justify-content-between align-items-center p-2 border rounded mb-2";
    div.innerHTML = `
    <div>
    <strong>${name} - ${version}</strong>
    <p class="mb-0" style="font-size: 0.9em; color: #666;">${description}</p>
    </div>
    <button onClick="removeDependency(this, '${name}')" class="btn btn-danger btn-sm">Remove</button>
    `;
    dependencyContainer.appendChild(div);
    input.value = ""; // Clear the input field after adding
    dependencyList.innerHTML = ""; // Clear the dependency list
}


function removeDependency(button, name) {
    const dependencyDiv = button.parentElement;
    dependencyDiv.remove();
    delete dep[name]; // Remove the dependency from the object
}

document
    .getElementById("generateFile")
    .addEventListener("click", async (e) => {
        const button = e.target;
        const entryPoint = document.getElementById("entryPoint").value;
        const port = document.getElementById("port").value;
        const description = document.getElementById("description").value;
        const folderStructure = document.querySelector('input[name="folderStructure"]:checked').id;
        const packageJson = {
            name: "node-initializer",
            version: "1.0.0",
            main: entryPoint,
            scripts: {
                start: `node ${entryPoint}`,
                dev: isTypescriptSelected ? `ts-node ${entryPoint}` : `nodemon ${entryPoint}`,
                test: "echo \"Error: no test specified\" && exit 1"
            },
            description: description,
            keywords: [],
            author: "",
            license: "ISC",
            dependencies: dep,
            devDependencies: devDep
        };

        const data = {
            packageJson,
            port: port || 3000,
            folderStructure,
            isTypescriptSelected
        };


        button.disabled = true;
        button.innerHTML = ''
        button.innerHTML = `
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        Generating...
        `;

        fetch("/create-project", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        })
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error("Failed to create project");
                }
                const fileName = res.headers.get("Content-Disposition").split("filename=")[1]
                    .replace(/["']/g, "")
                    .trim();

                const blob = await res.blob()

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
            })
            .catch((error) => {
                console.error("Error:", error);
            }).finally(() => {
                button.disabled = false;
                button.innerHTML = ''
                button.innerHTML = `<i class="bi bi-rocket-takeoff-fill me-1"></i> Generate`;
            });
    });



async function needsTypeDefinition(pkgName) {
    try {
        // Step 1: Check if main package has built-in types
        const url = `https://registry.npmjs.org/${pkgName}`;
        const res = await fetch(url);
        if (!res.ok) return false;

        const data = await res.json();
        const latestVersion = data["dist-tags"]?.latest;
        const latestMeta = data.versions?.[latestVersion];

        // If the package already includes types, no need for @types/...
        if (latestMeta?.types || latestMeta?.typings) {
            return false;
        }

        // Step 2: Check if @types/package exists
        const typesName = pkgName.startsWith('@')
            ? `@types/${pkgName.slice(1).replace('/', '__')}`
            : `@types/${pkgName}`;
        const typesUrl = `https://registry.npmjs.org/${encodeURIComponent(typesName)}`;
        const typesRes = await fetch(typesUrl);
        return typesRes.status === 200;
    } catch (err) {
        console.error(`Error checking types for ${pkgName}:`, err);
        return false;
    }
}

// Check if the window width is less than or equal to 576px (Bootstrap's small breakpoint)
// and alert the user if so
if (window.innerWidth <= 576) {
    alert("This website is not optimized for mobile devices. Please use a desktop browser for the best experience.");
}


