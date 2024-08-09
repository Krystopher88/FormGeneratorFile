document.addEventListener("DOMContentLoaded", () => {
    const editor = new Drawflow(document.getElementById("drawflow"));

    editor.zoom_min = 0.5; // Niveau de zoom minimum
    editor.zoom_max = 1.6; // Niveau de zoom maximum
    editor.zoom_value = 0.1; // Valeur du pas de zoom

    editor.start();
    editor.reroute = true;
    editor.reroute_fix_curvature = false;

    let nodeValues = {};
    let importedNodeValues = {};
    let modifiedNodeValues = {};
    let selectCounter = 0;
    let textCounter = 0;
    let checkboxCounter = 0;
    let isDiagramModified = false; // Indicateur de modification du diagramme

    setupTool("selectMultipleTool", "selectMultipleNode");
    setupTool("text", "textNode");
    setupTool("checkboxTool", "checkboxNode");

    function setupTool(toolId, nodeType) {
        const toolElement = document.getElementById(toolId);
        toolElement.setAttribute("draggable", true);

        toolElement.addEventListener("dragstart", (event) => {
            event.dataTransfer.setData("nodeType", nodeType);
        });
    }

    function generateNodeId(nodeType) {
        switch (nodeType) {
            case "selectMultipleNode":
                selectCounter += 1;
                return "select-" + selectCounter;
            case "textNode":
                textCounter += 1;
                return "text-" + textCounter;
            case "checkboxNode":
                checkboxCounter += 1;
                return "checkbox-" + checkboxCounter;
            default:
                throw new Error("Type de nœud non reconnu.");
        }
    }

    const gridSize = 20;

    function snapToGrid(x, y) {
        const snappedX = Math.round(x / gridSize) * gridSize;
        const snappedY = Math.round(y / gridSize) * gridSize;
        return { x: snappedX, y: snappedY };
    }

    document.getElementById("drawflow").addEventListener("drop", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const nodeType = event.dataTransfer.getData("nodeType");

        const x = event.pageX;
        const y = event.pageY;

        const rect = document.getElementById("drawflow").getBoundingClientRect();
        const containerOffsetX = rect.left + window.scrollX;
        const containerOffsetY = rect.top + window.scrollY;

        const relativeX = x - containerOffsetX;
        const relativeY = y - containerOffsetY;

        if (nodeType === "selectMultipleNode") {
            addSelectMultipleNode(relativeX, relativeY);
        } else if (nodeType === "textNode") {
            addTextNode(relativeX, relativeY);
        } else if (nodeType === "checkboxNode") {
            addCheckboxNode(relativeX, relativeY);
        }
        isDiagramModified = true; // Marquer le diagramme comme modifié
    });

    document.getElementById("drawflow").addEventListener("dragover", (event) => {
        event.preventDefault();
    });

    function cleanNodeValues() {
        for (let nodeId in nodeValues) {
            const nodeData = nodeValues[nodeId];
            if (nodeData.options) {
                nodeData.options = nodeData.options.filter((option) => {
                    return option !== "Entrez votre texte" && !/^Option \d+$/.test(option);
                });
            }
        }
    }

    document.getElementById("exportButton").addEventListener("click", () => {
        cleanNodeValues();
        const exportedData = {
            drawflow: editor.export(),
            nodeValues: mergeNodeValues(importedNodeValues, modifiedNodeValues),
        };
        downloadJSON(exportedData);
        isDiagramModified = false; // Réinitialiser l'indicateur après l'exportation
    });

    function downloadJSON(data) {
        const fileNameInput = document.getElementById("nameJson");
        let fileName = fileNameInput.value.trim();
        if (!fileName) {
            fileName = "drawflow_export";
        }
        fileName += ".json";
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchorNode = document.createElement("a");
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", fileName);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    document.getElementById("saveButton").addEventListener("click", () => {
        cleanNodeValues();
        const exportedData = {
            drawflow: editor.export(),
            nodeValues: mergeNodeValues(importedNodeValues, modifiedNodeValues),
        };
        saveJsonToServer(exportedData);
        isDiagramModified = false; // Réinitialiser l'indicateur après l'exportation
    });

    function mergeNodeValues(imported, modified) {
        const merged = { ...imported };
        for (let nodeId in modified) {
            if (!merged[nodeId]) {
                merged[nodeId] = {};
            }
            merged[nodeId] = { ...merged[nodeId], ...modified[nodeId] };
        }
        return merged;
    }

    function saveJsonToServer(data) {
        const fileNameInput = document.getElementById("nameJson");
        let fileName = fileNameInput.value.trim();
        if (!fileName) {
            fileName = "drawflow_export";
        }

        fetch("/form/save", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ data, fileName }),
        })
        .then((response) => response.json())
        .then((data) => {
            if (data.status === "success") {
                alert("Le fichier a été sauvegardé avec succès.");
            } else {
                alert("Erreur lors de la sauvegarde : " + data.message);
            }
        })
        .catch((error) => console.error("Erreur:", error));
    }

    document.getElementById("importButtonServer").addEventListener("click", () => {
        document.getElementById("importFile").click();
    });

    document.getElementById("importFile").addEventListener("change", function (event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const content = e.target.result;
                const data = JSON.parse(content);
                editor.import(data.drawflow);
                importedNodeValues = data.nodeValues || {};
    
                for (let nodeId in importedNodeValues) {
                    const nodeData = importedNodeValues[nodeId];
                    const nodeElement = document.getElementById(nodeId);
    
                    if (nodeElement) {
                        if (nodeData.label !== undefined) {
                            const labelInput = nodeElement.querySelector('input[data-field="label"]');
                            if (labelInput) {
                                labelInput.value = nodeData.label;
                                // Ajouter écouteur pour enregistrer les modifications
                                labelInput.addEventListener('input', function() {
                                    updateNodeValue(nodeId, 'label', this.value);
                                });
                            } else {
                                console.warn(`Label input not found for node ${nodeId}`);
                            }
                        }
    
                        if (Array.isArray(nodeData.options)) {
                            const optionsContainer = document.getElementById(`options-container-${nodeId}`);
                            while (optionsContainer.firstChild) {
                                optionsContainer.removeChild(optionsContainer.firstChild);
                            }
    
                            nodeData.options.forEach((option, index) => {
                                createOptionForImport(nodeId, index, option);
                            });
                        }
    
                        if (nodeData.text !== undefined) {
                            const textInput = nodeElement.querySelector('input[placeholder="Entrez votre texte ici"]');
                            if (textInput) {
                                textInput.value = nodeData.text;
                                // Ajouter écouteur pour enregistrer les modifications
                                textInput.addEventListener('input', function() {
                                    updateNodeValue(nodeId, 'text', this.value);
                                });
                            }
                        }
    
                        // Mise à jour du type de nœud
                        if (nodeData.type) {
                            nodeValues[nodeId] = { type: nodeData.type };
                        } else {
                            console.warn(`Type for node ${nodeId} is undefined`);
                        }
                    } else {
                        console.warn(`Node element with ID ${nodeId} not found.`);
                    }
                }
            };
            reader.readAsText(file);
        }
        isDiagramModified = true; // Marquer le diagramme comme modifié
    });

    function createOptionForImport(nodeId, index, value) {
        const optionsContainer = document.getElementById(`options-container-${nodeId}`);
        if (!optionsContainer) {
            return;
        }

        const optionDiv = document.createElement("div");
        optionDiv.className = "option-item";

        const optionInput = document.createElement("input");
        optionInput.type = "text";
        optionInput.value = value;
        optionInput.setAttribute("data-node-id", nodeId);
        optionInput.setAttribute("data-option-index", index);

        const deleteIcon = document.createElement("i");
        deleteIcon.className = "bi bi-trash ms-2";
        deleteIcon.title = "Remove Option";
        deleteIcon.onclick = function () {
            optionsContainer.removeChild(optionDiv);
        };

        optionDiv.appendChild(optionInput);
        optionDiv.appendChild(deleteIcon);
        optionsContainer.appendChild(optionDiv);

        // Ajouter écouteur pour enregistrer les modifications
        optionInput.addEventListener('input', function() {
            updateNodeOption(nodeId, index, this.value);
        });
    }

    document.querySelectorAll(".diagram-link").forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault(); // Empêche la navigation par défaut

            const diagramId = event.currentTarget.getAttribute("data-id");
            console.log(diagramId)
            fetch(`/form/fetch-json-modal/${diagramId}`)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error("Network response was not ok");
                    }
                    return response.json();
                })
                .then((data) => {
                    if (typeof data === "string") {
                        data = JSON.parse(data);
                    }
                    editor.import(data.drawflow);
                    importedNodeValues = data.nodeValues || {};
                    console.log(importedNodeValues);

                    for (let nodeId in importedNodeValues) {
                        const nodeData = importedNodeValues[nodeId];
                        const nodeElement = document.getElementById(nodeId);

                        if (nodeElement) {
                            if (nodeData.label !== undefined) {
                                const labelInput = nodeElement.querySelector('input[data-field="label"]');
                                if (labelInput) {
                                    labelInput.value = nodeData.label;
                                    // Ajouter écouteur pour enregistrer les modifications
                                    labelInput.addEventListener('input', function() {
                                        updateNodeValue(nodeId, 'label', this.value);
                                    });
                                } else {
                                    console.warn(`Label input not found for node ${nodeId}`);
                                }
                            }

                            if (Array.isArray(nodeData.options)) {
                                const optionsContainer = document.getElementById(`options-container-${nodeId}`);
                                while (optionsContainer.firstChild) {
                                    optionsContainer.removeChild(optionsContainer.firstChild);
                                }

                                nodeData.options.forEach((option, index) => {
                                    createOptionForImportBdd(nodeId, index, option);
                                });
                            }

                            if (nodeData.text !== undefined) {
                                const textInput = nodeElement.querySelector('input[placeholder="Entrez votre texte ici"]');
                                if (textInput) {
                                    textInput.value = nodeData.text;
                                    // Ajouter écouteur pour enregistrer les modifications
                                    textInput.addEventListener('input', function() {
                                        updateNodeValue(nodeId, 'text', this.value);
                                    });
                                }
                            }

                            // Mise à jour du type de nœud
                            if (nodeData.type) {
                                nodeValues[nodeId] = { type: nodeData.type };
                            } else {
                                console.warn(`Type for node ${nodeId} is undefined`);
                            }
                        } else {
                            console.warn(`Node element with ID ${nodeId} not found.`);
                        }
                    }

                    isDiagramModified = true; // Marquer le diagramme comme modifié
                })
                .catch((error) => {
                    console.error("There has been a problem with your fetch operation:", error);
                });
        });
    });

    function createOptionForImportBdd(nodeId, index, value) {
        const optionsContainer = document.getElementById(`options-container-${nodeId}`);
        if (!optionsContainer) {
            return;
        }

        const optionDiv = document.createElement("div");
        optionDiv.className = "option-item";

        const optionInput = document.createElement("input");
        optionInput.type = "text";
        optionInput.value = value;
        optionInput.setAttribute("data-node-id", nodeId);
        optionInput.setAttribute("data-option-index", index);

        const deleteIcon = document.createElement("i");
        deleteIcon.className = "bi bi-trash ms-2";
        deleteIcon.title = "Remove Option";
        deleteIcon.onclick = function () {
            optionsContainer.removeChild(optionDiv);
        };

        optionDiv.appendChild(optionInput);
        optionDiv.appendChild(deleteIcon);
        optionsContainer.appendChild(optionDiv);

        // Ajouter écouteur pour enregistrer les modifications
        optionInput.addEventListener('input', function() {
            updateNodeOption(nodeId, index, this.value);
        });
    }

    document.getElementById("createButton").addEventListener("click", (event) => {
        confirmNavigation(() => location.reload());
    });

    document.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", (event) => {
            if (isDiagramModified) {
                event.preventDefault();
                confirmNavigation(() => (window.location.href = link.href));
            }
        });
    });

    function confirmNavigation(onConfirm) {
        onConfirm();
    }

    function addSelectMultipleNode(x, y) {
        let nodeId = "node-" + Date.now();
        const initialOptionValue = "Entrez votre texte";
        nodeValues[nodeId] = {
            type: "selectMultipleNode",
            label: "",
            options: [initialOptionValue],
        };

        editor.addNode(
            "selectMultipleNode",
            1,
            1,
            x,
            y,
            "selectMultipleTool",
            { name: "Select Multiple" },
            `
            <div class="selectMultipleTool" id="${nodeId}">
                <input type="text" placeholder="Label" data-node-id="${nodeId}" data-field="label" />
                <div id="options-container-${nodeId}">
                    <div class="option-item">
                        <input type="text" value="${initialOptionValue}" data-node-id="${nodeId}" data-option-index="0" />
                        <i class="bi bi-trash ms-2" onclick="removeOption('${nodeId}', 0)" title="Supprimer la ligne"></i>
                    </div>
                </div>
                <i class="bi bi-plus" onclick="addOption('${nodeId}')" title="Ajouter une ligne"></i>
            </div>
        `
        );

        attachNodeEvents(nodeId, "selectMultipleNode");
        isDiagramModified = true;
    }

    function addTextNode(x, y) {
        let nodeId = "node-" + Date.now();
        nodeValues[nodeId] = { type: "textNode", label: "", text: "" };

        editor.addNode(
            "textNode",
            1,
            1,
            x,
            y,
            "textTool",
            { name: "Champ Texte" },
            `
            <div class="textTool" id="${nodeId}">
                <input type="text" placeholder="Label" data-node-id="${nodeId}" data-field="label" />
            </div>
        `
        );

        attachNodeEvents(nodeId, "textNode");
        isDiagramModified = true;
    }

    function addCheckboxNode(x, y) {
        let nodeId = "node-" + Date.now();
        nodeValues[nodeId] = { type: "checkboxNode", label: "" };

        editor.addNode(
            "checkboxNode",
            1,
            1,
            x,
            y,
            "checkboxTool",
            { name: "Checkbox" },
            `
            <div class="checkboxTool" id="${nodeId}">
                <input type="text" placeholder="Label" data-node-id="${nodeId}" data-field="label" />
                <input type="checkbox" data-node-id="${nodeId}" style="display:none;" />
            </div>
        `
        );

        attachNodeEvents(nodeId, "checkboxNode");
        isDiagramModified = true;
    }

    function attachNodeEvents(nodeId, nodeType) {
        const nodeElement = document.getElementById(nodeId);

        nodeElement.querySelectorAll("input").forEach((input) => {
            if (input.type === "text") {
                input.addEventListener("input", (event) => {
                    const inputElement = event.target;
                    const field = inputElement.getAttribute("data-field");
                    if (field) {
                        updateNodeValue(nodeId, field, inputElement.value);
                    } else {
                        const optionIndex = inputElement.getAttribute("data-option-index");
                        updateNodeOption(nodeId, optionIndex, inputElement.value);
                    }
                });
            } else if (input.type === "checkbox") {
                input.addEventListener("change", (event) => {
                    const inputElement = event.target;
                    updateNodeValue(nodeId, 'checked', inputElement.checked);
                });
            }
        });
    }

    function updateNodeValue(nodeId, field, value) {
        if (!modifiedNodeValues[nodeId]) {
            modifiedNodeValues[nodeId] = {};
        }
        modifiedNodeValues[nodeId][field] = value;

        // Assurez-vous que le type est toujours présent
        if (!modifiedNodeValues[nodeId].type && nodeValues[nodeId] && nodeValues[nodeId].type) {
            modifiedNodeValues[nodeId].type = nodeValues[nodeId].type;
        }
    }

    function updateNodeOption(nodeId, index, value) {
        if (!modifiedNodeValues[nodeId]) {
            modifiedNodeValues[nodeId] = {};
        }
        if (!modifiedNodeValues[nodeId].options) {
            modifiedNodeValues[nodeId].options = [];
        }
        modifiedNodeValues[nodeId].options[index] = value;

        // Assurez-vous que le type est toujours présent
        if (!modifiedNodeValues[nodeId].type && nodeValues[nodeId] && nodeValues[nodeId].type) {
            modifiedNodeValues[nodeId].type = nodeValues[nodeId].type;
        }
    }

    window.addOption = function (nodeId) {
        const optionsContainer = document.getElementById(`options-container-${nodeId}`);
        const optionIndex = optionsContainer.children.length;
        const optionValue = `Option ${optionIndex + 1}`;
        const optionDiv = document.createElement("div");
        optionDiv.className = "option-item";
        optionDiv.innerHTML = `
            <input type="text" value="${optionValue}" data-node-id="${nodeId}" data-option-index="${optionIndex}" />
            <i class="bi bi-trash ms-2" onclick="removeOption('${nodeId}', ${optionIndex})" title="Remove Option"></i>
        `;
        optionsContainer.appendChild(optionDiv);

        updateNodeOption(nodeId, optionIndex, optionValue);

        optionDiv.querySelector("input").addEventListener("input", (event) => {
            const inputElement = event.target;
            const optionIndex = inputElement.getAttribute("data-option-index");
            updateOptionText(nodeId, optionIndex, inputElement.value);
        });
    };

    window.removeOption = function (nodeId, index) {
        const optionsContainer = document.getElementById(`options-container-${nodeId}`);
        if (optionsContainer.children.length > 0) {
            optionsContainer.removeChild(optionsContainer.children[index]);
            updateNodeOption(nodeId, index, null); // Marquer l'option comme supprimée
            updateOptionsIndices(nodeId);
        }
    };

    window.updateOptionText = function (nodeId, index, newText) {
        updateNodeOption(nodeId, index, newText);
    };

    function updateOptionsIndices(nodeId) {
        const optionsContainer = document.getElementById(`options-container-${nodeId}`);
        for (let i = 0; i < optionsContainer.children.length; i++) {
            const optionDiv = optionsContainer.children[i];
            optionDiv.querySelector("i.bi-trash").setAttribute("onclick", `removeOption('${nodeId}', ${i})`);
            optionDiv.querySelector("input").setAttribute("data-option-index", `${i}`);
        }
    }
});
