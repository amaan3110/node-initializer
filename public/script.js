const input = document.getElementById("dependency");
const dependencyList = document.getElementById("dependencyList");

var dep = {
    express: "5.1.0",
};

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
            li.addEventListener("click", () => {
                addDependencyToUI(name, description, version);
                if (dep[name]) return;
                dep[name] = version; // Store the dependency
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
        e.preventDefault();
        const entryPoint = document.getElementById("entryPoint").value;
        const port = document.getElementById("port").value;
        const description = document.getElementById("description").value;

        const packageJson = {
            name: "node-initializer",
            version: "1.0.0",
            main: entryPoint,
            scripts: {
                start: `node ${entryPoint}`,
            },
            description: description,
            keywords: [],
            author: "",
            license: "ISC",
            dependencies: dep,
        };

        const data = {
            packageJson,
            port: port || 3000,
        };

        fetch("/create-project", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        })
            .then((res) => res.blob())
            .then((blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `project-${Date.now()}.zip`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            })
            .catch((error) => {
                console.error("Error:", error);
            });
    });

