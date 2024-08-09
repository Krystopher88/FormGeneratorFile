document.addEventListener("DOMContentLoaded", function () {
    const typeObjetSelect = document.querySelector('[name="sav[typeObjet]"]');
    const formContainer = document.getElementById("form-container");
    const etatObjetForm = document.getElementById("sav_etatObjetForm");
    const form = document.querySelector("form");

    // Assurez-vous de sélectionner le bon formulaire
    if (form) {
        form.addEventListener("submit", function (event) {
            updateHiddenField();
            // event.preventDefault() // Uncomment if you want to prevent form submission
        });
    }

    if (!typeObjetSelect) {
        console.error("Élément typeObjetSelect non trouvé");
        return;
    }

    // Initialisation de Select2 pour typeObjetSelect
    $(typeObjetSelect).select2();

    // Écoute de l'événement change via Select2
    $(typeObjetSelect).on("change", function (e) {
        const selectedType = $(this).val();
        const typeObjetBijouterieSelect = document.querySelector('[name="sav[typeObjetBijouterie]"]');

        if (selectedType && selectedType !== "Horlogerie") {
            if (typeObjetBijouterieSelect) {
                typeObjetBijouterieSelect.classList.remove("d-none");
                const label = document.querySelector(`label[for="${typeObjetBijouterieSelect.id}"]`);
                if (label) {
                    label.classList.remove("d-none");
                }
                // Remove 'd-none' class from the Select2 container
                $(typeObjetBijouterieSelect).next(".select2-container").removeClass("d-none");

                // Ajouter l'écouteur pour `typeObjetBijouterieSelect` uniquement ici
                $(typeObjetBijouterieSelect).on("change", function () {
                    let fetchArg = $(this).val();
                    const urlEtat = $(typeObjetSelect).data("etat");
                    const fetchUrl = `${urlEtat}?typeObjet=${encodeURIComponent(fetchArg)}`;
                    fetch(fetchUrl)
                        .then((response) => {
                            if (!response.ok) {
                                throw new Error(
                                    `Erreur HTTP! statut: ${response.status}`
                                );
                            }
                            return response.json();
                        })
                        .then((data) => {
                            drawflow = data.drawflow.drawflow.Home.data;
                            nodeValues = data.nodeValues;

                            if (!drawflow || !nodeValues) {
                                console.error(
                                    "Données manquantes dans la réponse:",
                                    data
                                );
                                return;
                            }

                            formContainer.innerHTML = ""; // Effacer les champs dynamiques précédents
                            generateInitialForm(drawflow, nodeValues);
                        })
                        .catch((error) =>
                            console.error(
                                "Erreur lors du chargement du JSON:",
                                error
                            )
                        );
                });
            }
        } else {
            if (typeObjetBijouterieSelect) {
                typeObjetBijouterieSelect.classList.add("d-none");
                const label = document.querySelector(
                    `label[for="${typeObjetBijouterieSelect.id}"]`
                );
                if (label) {
                    label.classList.add("d-none");
                }
                // Add 'd-none' class to the Select2 container
                $(typeObjetBijouterieSelect)
                    .next(".select2-container")
                    .addClass("d-none");

                // Continuer directement si `selectedType` est "Horlogerie"
                let fetchArg = selectedType;
                // Route dans le formType SAV
                const urlEtat = $(typeObjetSelect).data("etat");
                const fetchUrl = `${urlEtat}?typeObjet=${encodeURIComponent(
                    fetchArg
                )}`;

                fetch(fetchUrl)
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error(
                                `Erreur HTTP! statut: ${response.status}`
                            );
                        }
                        return response.json();
                    })
                    .then((data) => {
                        drawflow = data.drawflow.drawflow.Home.data;
                        nodeValues = data.nodeValues;

                        if (!drawflow || !nodeValues) {
                            console.error(
                                "Données manquantes dans la réponse:",
                                data
                            );
                            return;
                        }

                        formContainer.innerHTML = ""; // Effacer les champs dynamiques précédents
                        generateInitialForm(drawflow, nodeValues);
                    })
                    .catch((error) =>
                        console.error(
                            "Erreur lors du chargement du JSON:",
                            error
                        )
                    );
            }
        }
    });

    // Fonction pour générer les premières questions (champs de départ)
    function generateInitialForm(drawflow, nodeValues) {
        const entryNodes = findEntryNodes(drawflow);
        const initialNodes = mergeNodesByLabel(entryNodes, nodeValues);
        displayNodes(initialNodes, nodeValues, drawflow, true); // Affiche les champs d'entrée
    }

    // Fonction pour trouver les nœuds d'entrée (sans connexions d'entrée)
    function findEntryNodes(drawflow) {
        return Object.values(drawflow).filter((node) =>
            Object.values(node.inputs).every(
                (input) => input.connections.length === 0
            )
        );
    }

    // Fonction pour regrouper les nœuds par label pour les select fusionnés
    function mergeNodesByLabel(nodes, nodeValues) {
        const grouped = {};
        nodes.forEach((node) => {
            const nodeValueId = extractNodeValueId(node.html);
            const nodeValue = nodeValues[`node-${nodeValueId}`];
            if (nodeValue) {
                const label = nodeValue.label;
                if (!grouped[label]) {
                    grouped[label] = [];
                }
                grouped[label].push(node);
            }
        });
        return grouped;
    }

    // Fonction pour extraire l'ID de nodeValues à partir du champ HTML du noeud
    function extractNodeValueId(html) {
        const idMatch = html.match(/id="node-(\d+)"/);
        return idMatch ? idMatch[1] : null;
    }

    // Fonction pour afficher les nœuds (formulaire initial et suivant)
    function displayNodes(
        nodesByLabel,
        nodeValues,
        drawflow,
        isInitial = false
    ) {
        for (const label in nodesByLabel) {
            if (nodesByLabel.hasOwnProperty(label)) {
                createFormElement(
                    nodesByLabel[label],
                    nodeValues,
                    drawflow,
                    isInitial
                );
            }
        }
    }

    // Fonction pour créer un élément de formulaire en fonction des nœuds
    function createFormElement(nodes, nodeValues, drawflow, isInitial) {
        const container = document.getElementById("form-container");
        const firstNode = nodes[0]; // Utiliser le premier nœud comme référence
        const nodeValueId = extractNodeValueId(firstNode.html);
        const nodeValue = nodeValues[`node-${nodeValueId}`];
    
        if (!nodeValue) {
            console.error(`Node value not found for node with value id ${nodeValueId}`);
            return;
        }
    
        if (!nodeValue.type) {
            console.error(`Node type is undefined for node with value id ${nodeValueId}`);
            return;
        }
    
        const element = document.createElement("div");
        element.classList.add("mb-3");
        element.dataset.nodeId = nodes.map((node) => node.id).join(",");
        element.dataset.nodeType = nodeValue.type;
        element.dataset.label = nodeValue.label;
    
        switch (nodeValue.type) {
            case "selectMultipleNode":
                createSelectElement(
                    nodes,
                    nodeValue.label,
                    nodeValues,
                    element,
                    drawflow
                );
                break;
            case "textNode":
                createTextElement(firstNode, nodeValue, element);
                break;
            default:
                console.error(`Unknown node type: ${nodeValue.type}`);
                return;
        }
    
        container.appendChild(element);
        if (isInitial) {
            element.style.display = "block"; // Rendre les éléments d'entrée initiaux visibles
        }
    }
    

    // Fonction pour créer un élément select fusionné
    function createSelectElement(nodes, label, nodeValues, element, drawflow) {
        const labelElement = document.createElement("label");
        labelElement.classList.add("form-label");
        labelElement.innerText = label;
        element.appendChild(labelElement);
    
        const select = document.createElement("select");
        select.classList.add("select2", "form-control");
        select.dataset.label = label;
    
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.innerText = "Choisir";
        select.appendChild(defaultOption);
    
        nodes.forEach((node) => {
            const nodeValueId = extractNodeValueId(node.html);
            const nodeValue = nodeValues[`node-${nodeValueId}`];
    
            if (!nodeValue || !Array.isArray(nodeValue.options)) {
                console.error(`Options manquantes ou non valides pour le nœud ID ${nodeValueId}`);
                return; // Passe au nœud suivant
            }
    
            nodeValue.options.forEach((option, index) => {
                const optionElement = document.createElement("option");
                optionElement.value = `${node.id}-${index}`;
                optionElement.innerText = option;
                select.appendChild(optionElement);
            });
        });
    
        select.addEventListener("change", (e) => {
            handleNodeSelection(e, drawflow, nodeValues);
        });
    
        element.appendChild(select);
    
        // Initialisation de Select2 pour ce nouvel élément <select>
        $(select).select2();
        const select2Container = select.nextElementSibling;
        if (select2Container && select2Container.classList.contains("select2-container")) {
            select2Container.style.width = "100%"; // Assure que le conteneur Select2 prend 100% de la largeur
        }
        // Utilisation de l'événement `select2:select` propre à Select2
        $(select).on("select2:select", function (e) {
            const selectedValue = e.params.data.id;
            // Manuellement déclencher l'événement `change` natif si nécessaire
            select.dispatchEvent(new Event("change"));
        });
    }
    

    // Fonction pour créer un élément text
    function createTextElement(node, nodeValue, element) {
        // Créer un conteneur pour le champ
        const container = document.createElement("div");
        container.classList.add("form-group");
        container.dataset.nodeId = node.id;

        // Créer et ajouter un label pour l'input
        const labelElement = document.createElement("label");
        labelElement.innerText = nodeValue.label;
        container.appendChild(labelElement);

        // Créer l'élément input
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = nodeValue.label;
        input.classList.add("form-control");
        input.dataset.nodeId = node.id;
        input.dataset.label = nodeValue.label;

        // Ajouter l'input dans le conteneur
        container.appendChild(input);

        // Ajouter le conteneur complet à l'élément parent
        element.appendChild(container);

        // Ajouter un écouteur d'événements pour capturer les modifications de l'utilisateur
        input.addEventListener("input", () => handleTextInput(node.id));
    }

    // Fonction pour gérer l'entrée dans un champ de texte
    function handleTextInput(nodeId) {
        const container = document.getElementById("form-container");
        const nextNodeIds = findNextNodes(nodeId);

        if (nextNodeIds.length === 0) {
            return; // Arrêter l'exécution si aucun champ suivant
        }

        // Supprimer les éléments non pertinents après le champ texte modifié
        let foundTextNode = false;
        Array.from(container.children).forEach((child) => {
            if (foundTextNode) {
                child.remove();
            } else if (
                child.dataset.nodeId &&
                child.dataset.nodeId.includes(nodeId)
            ) {
                foundTextNode = true;
            }
        });

        // Continuer avec l'affichage des nouveaux champs
        const nextNodes = nextNodeIds.map((id) => drawflow[id]).filter(Boolean);
        const mergedNextNodes = mergeNodesByLabel(nextNodes, nodeValues);
        displayMergedNodes(mergedNextNodes, nodeValues, drawflow);
    }

    // Fonction pour trouver les prochains noeuds à partir d'un nœud sélectionné
    function findNextNodes(selectedNodeId) {
        const nextNodeIds = new Set();
        const node = drawflow[selectedNodeId];
        if (node) {
            Object.values(node.outputs).forEach((output) => {
                output.connections.forEach((connection) => {
                    nextNodeIds.add(connection.node);
                });
            });
        } else {
            console.warn(
                `Node with ID ${selectedNodeId} not found in drawflow`
            );
        }
        return Array.from(nextNodeIds);
    }

    // Fonction pour gérer la sélection d'un noeud
    function handleNodeSelection(event, drawflow, nodeValues) {
        const selectedValue = event.target
            ? event.target.value
            : event.params.data.id;

        if (!selectedValue) return;

        const [selectedNodeId, optionIndex] = selectedValue.split("-");
        const selectedNode = drawflow[selectedNodeId];
        if (!selectedNode) {
            console.error(
                `Nœud sélectionné avec ID ${selectedNodeId} non trouvé dans drawflow.`
            );
            return;
        }

        const nodeValueId = extractNodeValueId(selectedNode.html);
        const nodeValue = nodeValues[`node-${nodeValueId}`];
        const selectedOption = nodeValue.options[optionIndex];

        // Masquer et supprimer les éléments de formulaire après le champ modifié
        let foundSelectedElement = false;
        Array.from(formContainer.children).forEach((child) => {
            if (foundSelectedElement) {
                child.remove();
            } else if (
                child.dataset.nodeId &&
                child.dataset.nodeId.includes(selectedNodeId)
            ) {
                foundSelectedElement = true;
            }
        });

        // Trouver les nœuds suivants basés sur les connexions spécifiques à l'option sélectionnée
        const nextNodeIds = findNextNodes(selectedNodeId);

        if (nextNodeIds.length === 0) {
            return; // Arrêter l'exécution si aucun champ suivant
        }

        // Continuer avec l'affichage des nouveaux champs
        const nextNodes = nextNodeIds.map((id) => drawflow[id]).filter(Boolean);
        const mergedNextNodes = mergeNodesByLabel(nextNodes, nodeValues);
        displayMergedNodes(mergedNextNodes, nodeValues, drawflow);
        $("#wizard_new_sav").smartWizard("fixHeight");
    }

    // Fonction pour afficher les nœuds fusionnés (à partir des sélections)
    function displayMergedNodes(mergedNextNodes, nodeValues, drawflow) {
        for (const label in mergedNextNodes) {
            if (mergedNextNodes.hasOwnProperty(label)) {
                createFormElement(
                    mergedNextNodes[label],
                    nodeValues,
                    drawflow,
                    false
                );
                // Assurer que les nouveaux éléments sont rendus visibles
                const formGroups = document.querySelectorAll(
                    `[data-label="${label}"]`
                );
                formGroups.forEach((group) => {
                    group.style.display = "block";
                });
            }
        }
    }

    function updateHiddenField() {
        const formData = collectFormData();
        etatObjetForm.value = JSON.stringify(formData);
    }

    function collectFormData() {
        const data = [];
        // Rechercher tous les éléments ayant un data-node-id et non leurs conteneurs
        const elements = formContainer.querySelectorAll(
            "[data-node-id] select, [data-node-id] input"
        );

        elements.forEach((element) => {
            const container = element.closest("[data-node-id]"); // Le conteneur le plus proche avec data-node-id
            let value = null;
            let label = null;

            if (element.nodeName === "SELECT") {
                // Récupération du texte de l'option sélectionnée dans SELECT
                const selectedOption = element.options[element.selectedIndex];
                value = selectedOption ? selectedOption.text : null;
                label = container ? container.dataset.label : null;
            } else if (element.nodeName === "INPUT") {
                // Récupération de la valeur pour INPUT
                value = element.value || null;
                label = container ? container.dataset.label : null;
            }

            if (label && value !== null) {
                // S'assurer que les champs label et value ne sont pas nuls ou indéfinis
                data.push({ label: label, value: value });
            }
        });

        return data;
    }
});
