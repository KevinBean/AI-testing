/**
 * Enhanced Simplified Workflow System
 * With real-time progress, user intervention, and Markdown rendering
 */

/**
 * Load workflows with optional search filtering
 * @param {string} searchTerm - Optional search term
 */
function loadWorkflows(searchTerm = "") {
  $("#workflowList").empty();
  
  if (!db) {
    $("#workflowList").append('<li class="list-group-item text-danger">Database not available. Please refresh the page.</li>');
    return;
  }
  
  const transaction = db.transaction("workflows", "readonly");
  const store = transaction.objectStore("workflows");
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const workflow = cursor.value;
      const searchableText = (workflow.name + " " + (workflow.description || "")).toLowerCase();
      
      if (!searchTerm || searchableText.indexOf(searchTerm.toLowerCase()) !== -1) {
        const li = $("<li>")
          .addClass("list-group-item list-item")
          .html(`<strong>${workflow.name}</strong><br><small>${workflow.description || ""}</small>`)
          .click(function() { previewWorkflow(workflow); });
          
        const editBtn = $("<button>")
          .addClass("btn btn-sm btn-warning action-btn")
          .text("Edit")
          .click(function(e) { 
            e.stopPropagation(); 
            editWorkflow(workflow); 
          });
          
        const delBtn = $("<button>")
          .addClass("btn btn-sm btn-danger action-btn")
          .text("Delete")
          .click(function(e) { 
            e.stopPropagation(); 
            deleteWorkflow(workflow.id); 
          });
          
        li.append(editBtn, delBtn);
        $("#workflowList").append(li);
      }
      cursor.continue();
    }
  };
}

/**
 * Preview a workflow
 * @param {Object} workflow - The workflow to preview
 */
function previewWorkflow(workflow) {
  let html = `
    <h5>${workflow.name}</h5>
    <p>${workflow.description || "<em>No description</em>"}</p>

    <div class="workflow-steps-container">
  `;
  
  if (!workflow.steps || workflow.steps.length === 0) {
    html += `<div class="alert alert-warning">This workflow has no steps defined.</div>`;
  } else {
    workflow.steps.forEach((step, index) => {
      html += `
        <div class="card mb-2">
          <div class="card-header py-2">
            <strong>Step ${index + 1}: ${step.name || "Unnamed Step"}</strong>
          </div>
          <div class="card-body py-2">
            ${step.description ? `<p class="small text-muted">${step.description}</p>` : ''}
            <div class="d-flex justify-content-between">
              <div>
                ${step.actionId ? `<span class="badge badge-info">Action ID: ${step.actionId}</span>` : 
                  '<span class="badge badge-warning">No action selected</span>'}
              </div>
            </div>
          </div>
        </div>
      `;
    });
  }
  
  html += `</div>
    <div class="mt-3">
      <button class="btn btn-primary" id="configureWorkflowBtn" data-workflow-id="${workflow.id}">
        <i class="fas fa-cogs"></i> Configure & Run
      </button>
      ${workflow.config ? `
        <button class="btn btn-success" id="runSavedWorkflowBtn" data-workflow-id="${workflow.id}">
          <i class="fas fa-play"></i> Run with Saved Config
        </button>
      ` : ''}
    </div>
  `;
  
  $("#workflowPreview").html(html);
  
  // Set up event handlers
  $("#configureWorkflowBtn").click(function() {
    const workflowId = $(this).data("workflow-id");
    configureWorkflow(workflowId);
  });
  
  $("#runSavedWorkflowBtn").click(function() {
    const workflowId = $(this).data("workflow-id");
    runWorkflow(workflowId);
  });
}

/**
 * Edit a workflow
 * @param {Object} workflow - The workflow to edit
 */
function editWorkflow(workflow) {
  editingWorkflowId = workflow.id;
  $("#workflowName").val(workflow.name);
  $("#workflowDesc").val(workflow.description || "");
  $("#workflowSteps").empty();

  workflow.steps.forEach((step, index) => {
    const stepHtml = createWorkflowStepHTML(step, index);
    $("#workflowSteps").append(stepHtml);
  });

  $("#workflowForm button[type=submit]").text("Update Workflow");
}

/**
 * Create HTML for a workflow step
 * @param {Object} step - The step data
 * @param {number} index - Step index
 * @returns {jQuery} - Step HTML element
 */
function createWorkflowStepHTML(step, index) {
  const stepHtml = $(`
    <div class="workflow-step mb-3">
      <div class="form-group">
        <label>Step Name</label>
        <input type="text" class="form-control step-name" value="${step.name || ''}" placeholder="Enter step name">
      </div>
      <div class="form-group">
        <label>Step Description</label>
        <textarea class="form-control step-desc" rows="2" placeholder="Enter step description">${step.description || ''}</textarea>
      </div>
      <div class="form-group">
        <label>Action</label>
        <select class="form-control step-action-id">
          <option value="">Select an action...</option>
        </select>
      </div>
      <button type="button" class="btn btn-danger btn-sm remove-step-btn">Remove Step</button>
    </div>
  `);

  if (db) {
    const transaction = db.transaction("actions", "readonly");
    const store = transaction.objectStore("actions");
    store.openCursor().onsuccess = function (e) {
      const cursor = e.target.result;
      if (cursor) {
        const action = cursor.value;
        const selected = action.id === step.actionId ? 'selected' : '';
        stepHtml.find(".step-action-id").append(
          `<option value="${action.id}" ${selected}>${action.title}</option>`
        );
        cursor.continue();
      }
    };
  }

  stepHtml.find(".remove-step-btn").click(function () {
    stepHtml.remove();
  });

  return stepHtml;
}

/**
 * Delete a workflow
 * @param {number} id - The workflow ID to delete
 */
function deleteWorkflow(id) {
  if (confirm("Are you sure you want to delete this workflow?")) {
    if (!db) {
      showNotification("Database not available. Please refresh the page.", "danger");
      return;
    }
    
    const transaction = db.transaction("workflows", "readwrite");
    const store = transaction.objectStore("workflows");
    
    store.delete(id).onsuccess = function () {
      loadWorkflows();
      showNotification("Workflow deleted successfully!");
      if (editingWorkflowId === id) {
        resetWorkflowForm();
      }
    };
  }
}

/**
 * Reset the workflow form
 */
function resetWorkflowForm() {
  editingWorkflowId = null;
  $("#workflowForm")[0].reset();
  $("#workflowSteps").empty();
  $("#workflowForm button[type=submit]").text("Save Workflow");
}

/**
 * Handle workflow form submission
 * @param {Event} e - Form submission event
 */
function handleWorkflowFormSubmit(e) {
  e.preventDefault();
  
  const name = $("#workflowName").val().trim();
  const description = $("#workflowDesc").val().trim();
  
  if (!name) {
    showNotification("Workflow name is required", "warning");
    return;
  }
  
  const steps = [];
  $(".workflow-step").each(function() {
    const name = $(this).find(".step-name").val().trim();
    const description = $(this).find(".step-desc").val().trim();
    const actionId = parseInt($(this).find(".step-action-id").val());
    
    if (name) {
      steps.push({
        name,
        description,
        actionId: isNaN(actionId) ? null : actionId
      });
    }
  });
  
  if (!db) {
    showNotification("Database not available. Please refresh the page.", "danger");
    return;
  }
  
  const transaction = db.transaction("workflows", "readwrite");
  const store = transaction.objectStore("workflows");
  
  if (editingWorkflowId) {
    store.get(editingWorkflowId).onsuccess = function(e) {
      const workflow = e.target.result;
      workflow.name = name;
      workflow.description = description;
      workflow.steps = steps;
      workflow.updated = new Date();
      
      // Preserve existing configuration if it exists
      if (!workflow.config) {
        workflow.config = null;
      }
      
      store.put(workflow).onsuccess = function() {
        showNotification("Workflow updated successfully!");
        resetWorkflowForm();
        loadWorkflows();
      };
    };
  } else {
    const workflow = {
      name,
      description,
      steps,
      created: new Date(),
      config: null
    };
    
    store.add(workflow).onsuccess = function() {
      showNotification("New workflow created!");
      resetWorkflowForm();
      loadWorkflows();
    };
  }
}

/**
 * Configure a workflow
 * @param {number} workflowId - The workflow ID
 */
function configureWorkflow(workflowId) {
  if (!db) {
    showNotification("Database not available", "danger");
    return;
  }
  
  const transaction = db.transaction("workflows", "readonly");
  const store = transaction.objectStore("workflows");
  
  store.get(parseInt(workflowId)).onsuccess = function(e) {
    const workflow = e.target.result;
    if (!workflow) {
      showNotification("Workflow not found", "danger");
      return;
    }
    
    // Create or show the configuration modal
    if (!$("#workflow-config-modal").length) {
      $("body").append(`
        <div class="modal fade" id="workflow-config-modal" tabindex="-1" role="dialog">
          <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Configure Workflow</h5>
                <button type="button" class="close" data-dismiss="modal">&times;</button>
              </div>
              <div class="modal-body" id="workflow-config-body">
                <div class="text-center">
                  <i class="fas fa-spinner fa-spin"></i> Loading configuration...
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" id="save-config-btn">Save Configuration</button>
                <button type="button" class="btn btn-success" id="run-workflow-btn">Run Workflow</button>
              </div>
            </div>
          </div>
        </div>
      `);
    }
    
    // Get available tags to show in dropdown
    getAllTags().then(tags => {
      // Build the configuration form
      let configHtml = `
        <h5>${workflow.name}</h5>
        <p>${workflow.description || ""}</p>
        
        <div class="form-group">
          <label>Input Tags</label>
          <p class="text-muted small">Select tags to filter content for this workflow</p>
          <select id="workflow-tags" class="form-control" multiple>
            ${tags.map(tag => {
              const selected = workflow.config && workflow.config.tags && workflow.config.tags.includes(tag) ? 'selected' : '';
              return `<option value="${tag}" ${selected}>${tag}</option>`;
            }).join('')}
          </select>
        </div>
        
        <hr>
        <h5>Step Configurations</h5>
      `;
      
      // Add step configurations
      if (workflow.steps && workflow.steps.length > 0) {
        workflow.steps.forEach((step, index) => {
          const stepConfig = workflow.config && workflow.config.steps && workflow.config.steps[index] 
            ? workflow.config.steps[index] 
            : { usePreviousResult: index > 0, useTags: true, allowIntervention: true };
          
          configHtml += `
            <div class="card mb-3">
              <div class="card-header">
                <strong>Step ${index + 1}: ${step.name || "Unnamed Step"}</strong>
              </div>
              <div class="card-body">
                <p class="text-muted small">Configure how this step gets its input:</p>
                
                ${index > 0 ? `
                  <div class="custom-control custom-checkbox mb-2">
                    <input type="checkbox" id="use-previous-${index}" class="custom-control-input" ${stepConfig.usePreviousResult ? 'checked' : ''}>
                    <label class="custom-control-label" for="use-previous-${index}">
                      Use previous step's result as input
                    </label>
                  </div>
                ` : ''}
                
                <div class="custom-control custom-checkbox mb-2">
                  <input type="checkbox" id="use-tags-${index}" class="custom-control-input" ${stepConfig.useTags ? 'checked' : ''}>
                  <label class="custom-control-label" for="use-tags-${index}">
                    Use content with selected tags as input
                  </label>
                </div>
                
                <div class="custom-control custom-checkbox">
                  <input type="checkbox" id="allow-intervention-${index}" class="custom-control-input" ${stepConfig.allowIntervention ? 'checked' : ''}>
                  <label class="custom-control-label" for="allow-intervention-${index}">
                    Allow user intervention before this step
                  </label>
                </div>
              </div>
            </div>
          `;
        });
      } else {
        configHtml += `<div class="alert alert-warning">This workflow has no steps.</div>`;
      }
      
      // Update the modal content
      $("#workflow-config-body").html(configHtml);
      
      // Store workflow id for later use
      $("#workflow-config-modal").data("workflow-id", workflow.id);
      
      // Event handlers for buttons
      $("#save-config-btn").off("click").on("click", function() {
        saveWorkflowConfig(workflow.id, false);
      });
      
      $("#run-workflow-btn").off("click").on("click", function() {
        saveWorkflowConfig(workflow.id, true);
      });
      
      // Show the modal
      $("#workflow-config-modal").modal("show");
    });
  };
}

/**
 * Get all unique tags from blocks
 * @returns {Promise<Array>} - Array of unique tags
 */
function getAllTags() {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve([]);
      return;
    }
    
    const uniqueTags = new Set();
    const transaction = db.transaction("blocks", "readonly");
    const store = transaction.objectStore("blocks");
    
    store.openCursor().onsuccess = function(e) {
      const cursor = e.target.result;
      if (cursor) {
        const block = cursor.value;
        if (block.tags && block.tags.length > 0) {
          block.tags.forEach(tag => uniqueTags.add(tag));
        }
        cursor.continue();
      } else {
        resolve(Array.from(uniqueTags).sort());
      }
    };
    
    transaction.onerror = function(e) {
      reject(e.target.error);
    };
  });
}

/**
 * Save workflow configuration
 * @param {number} workflowId - The workflow ID
 * @param {boolean} runAfterSave - Whether to run the workflow after saving
 */
function saveWorkflowConfig(workflowId, runAfterSave = false) {
  if (!db) {
    showNotification("Database not available", "danger");
    return;
  }
  
  const tags = $("#workflow-tags").val() || [];
  
  // Create the configuration object
  const config = {
    tags: tags,
    steps: []
  };
  
  // Get the workflow data
  const transaction = db.transaction("workflows", "readwrite");
  const store = transaction.objectStore("workflows");
  
  store.get(parseInt(workflowId)).onsuccess = function(e) {
    const workflow = e.target.result;
    if (workflow && workflow.steps) {
      // Collect step configurations
      workflow.steps.forEach((step, index) => {
        config.steps[index] = {
          usePreviousResult: index > 0 && $(`#use-previous-${index}`).is(":checked"),
          useTags: $(`#use-tags-${index}`).is(":checked"),
          allowIntervention: $(`#allow-intervention-${index}`).is(":checked")
        };
      });
      
      // Save the workflow
      workflow.config = config;
      workflow.updated = new Date();
      
      store.put(workflow).onsuccess = function() {
        showNotification("Workflow configuration saved!");
        
        if (runAfterSave) {
          // Close the modal
          $("#workflow-config-modal").modal("hide");
          
          // Wait for modal to close before running
          setTimeout(() => {
            runWorkflow(workflowId);
          }, 500);
        }
      };
    } else {
      showNotification("Workflow not found", "danger");
    }
  };
}

/**
 * Run a workflow
 * @param {number} workflowId - The workflow ID
 */
async function runWorkflow(workflowId) {
  if (!db) {
    showNotification("Database not available", "danger");
    return;
  }
  
  const transaction = db.transaction("workflows", "readonly");
  const store = transaction.objectStore("workflows");
  
  // Get the workflow
  store.get(parseInt(workflowId)).onsuccess = async function(e) {
    const workflow = e.target.result;
    if (!workflow) {
      showNotification("Workflow not found", "danger");
      return;
    }
    
    if (!workflow.config) {
      showNotification("This workflow has no saved configuration. Please configure it first.", "warning");
      configureWorkflow(workflowId);
      return;
    }
    
    // Initialize results container
    initializeWorkflowResults(workflow);
    
    try {
      // Fetch content based on tags if needed
      let taggedContent = "";
      if (workflow.config.tags && workflow.config.tags.length > 0) {
        updateWorkflowStatus("Fetching content with tags: " + workflow.config.tags.join(", "));
        const blocks = await getBlocksByTags(workflow.config.tags);
        taggedContent = formatBlocksAsText(blocks);
      }
      
      // Execute each step
      let currentOutput = "";
      let abortWorkflow = false;
      
      for (let i = 0; i < workflow.steps.length; i++) {
        if (abortWorkflow) break;
        
        const step = workflow.steps[i];
        const stepConfig = workflow.config.steps[i] || {};
        
        // Create step container if it doesn't exist
        const stepContainerId = `workflow-step-${i}`;
        if (!$(`#${stepContainerId}`).length) {
          addStepContainer(i, step.name || `Step ${i+1}`);
        }
        
        // Skip if no action is selected
        if (!step.actionId) {
          updateStepStatus(i, "skipped", "No action selected for this step");
          continue;
        }
        
        // Intervention before step if enabled
        if (stepConfig.allowIntervention) {
          const shouldContinue = await userIntervention(i, step.name || `Step ${i+1}`, currentOutput);
          if (!shouldContinue) {
            abortWorkflow = true;
            updateWorkflowStatus("Workflow stopped by user");
            break;
          }
          
          // Check if user added custom content
          const userContentElement = document.getElementById("user-content-" + i);
          if (userContentElement && userContentElement.value) {
            const userContent = userContentElement.value.trim();
            if (userContent) {
              if (currentOutput) {
                currentOutput += "\n\n--- User Input ---\n\n" + userContent;
              } else {
                currentOutput = userContent;
              }
            }
          }
        }
        
        // Update step status
        updateStepStatus(i, "running");
        
        // Get the action
        try {
          const action = await getActionById(step.actionId);
          if (!action) {
            updateStepStatus(i, "error", "Action not found");
            continue;
          }
          
          // Prepare input content
          let inputContent = "";
          
          // Use previous step result if configured and available
          if (i > 0 && stepConfig.usePreviousResult && currentOutput) {
            inputContent = currentOutput;
          }
          
          // Use tagged content if configured
          if (stepConfig.useTags && taggedContent) {
            if (inputContent) {
              inputContent += "\n\n---\n\n";
            }
            inputContent += taggedContent;
          }
          
          // Skip if no input content
          if (!inputContent) {
            updateStepStatus(i, "skipped", "No input content available");
            continue;
          }
          
          // Preview input content
          updateStepInputPreview(i, inputContent);
          
          // Call the OpenAI API
          const prompt = action.prompt.replace(/{content}/g, inputContent);
          const result = await callOpenAiApi(action, prompt);
          
          // Save the result
          currentOutput = result;
          updateStepStatus(i, "success");
          updateStepResultPreview(i, result);
        } catch (error) {
          updateStepStatus(i, "error", error.message || "Unknown error");
          break;
        }
      }
      
      // Mark workflow as complete if not aborted
      if (!abortWorkflow) {
        updateWorkflowStatus("Workflow completed", "success");
        // Add copy and save buttons for final result
        if (currentOutput) {
          addFinalResultButtons(currentOutput);
        }
      }
    } catch (error) {
      updateWorkflowStatus("Error: " + (error.message || "An unknown error occurred"), "danger");
    }
  };
}

/**
 * Initialize the workflow results container
 * @param {Object} workflow - The workflow
 */
function initializeWorkflowResults(workflow) {
  const html = `
    <div class="workflow-execution">
      <div class="alert alert-info mb-3" id="workflow-status">
        <i class="fas fa-spinner fa-spin"></i> Initializing workflow: ${workflow.name}
      </div>
      <div class="workflow-steps-results"></div>
      <div id="final-result-actions" class="text-center mt-3" style="display: none;"></div>
    </div>
  `;
  
  const resultContainer = document.getElementById("workflowResultContainer");
  if (resultContainer) {
    resultContainer.innerHTML = html;
  } else {
    console.error("Workflow result container not found");
  }
}

/**
 * Add a step container to the results
 * @param {number} index - Step index
 * @param {string} name - Step name
 */
function addStepContainer(index, name) {
  const stepContainer = `
    <div class="card mb-3" id="workflow-step-${index}">
      <div class="card-header">
        <strong>Step ${index + 1}: ${name}</strong>
        <span class="badge badge-secondary float-right" id="step-status-${index}">Pending</span>
      </div>
      <div class="card-body">
        <div id="step-message-${index}" class="text-muted mb-2"></div>
        <div id="step-input-preview-${index}" style="display: none;">
          <h6>Input Content:</h6>
          <div class="input-preview p-2 mb-3 bg-light border rounded"></div>
        </div>
        <div id="step-result-preview-${index}" style="display: none;">
          <h6>Result:</h6>
          <div class="result-preview p-2 bg-light border rounded"></div>
        </div>
      </div>
    </div>
  `;
  
  const stepsContainer = document.querySelector(".workflow-steps-results");
  if (stepsContainer) {
    // Append the new step container
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = stepContainer;
    while (tempDiv.firstChild) {
      stepsContainer.appendChild(tempDiv.firstChild);
    }
  } else {
    console.error("Workflow steps container not found");
  }
}

/**
 * Update step status
 * @param {number} index - Step index
 * @param {string} status - Status (running, success, error, skipped)
 * @param {string} message - Optional message
 */
function updateStepStatus(index, status, message = "") {
  let badgeClass = "badge-secondary";
  let statusText = "Pending";
  
  switch (status) {
    case "running":
      badgeClass = "badge-primary";
      statusText = "Running";
      break;
    case "success":
      badgeClass = "badge-success";
      statusText = "Success";
      break;
    case "error":
      badgeClass = "badge-danger";
      statusText = "Error";
      break;
    case "skipped":
      badgeClass = "badge-warning";
      statusText = "Skipped";
      break;
  }
  
  // Update badge
  const statusElement = document.getElementById(`step-status-${index}`);
  if (statusElement) {
    statusElement.className = `badge float-right ${badgeClass}`;
    statusElement.textContent = statusText;
  } else {
    console.warn(`Status element #step-status-${index} not found`);
  }
  
  // Update message if provided
  const messageElement = document.getElementById(`step-message-${index}`);
  if (messageElement) {
    if (message) {
      messageElement.textContent = message;
    } else {
      messageElement.textContent = "";
    }
  } else {
    console.warn(`Message element #step-message-${index} not found`);
  }
}

/**
 * Update the step input preview
 * @param {number} index - Step index
 * @param {string} content - Input content
 */
function updateStepInputPreview(index, content) {
  const preview = document.getElementById(`step-input-preview-${index}`);
  if (preview) {
    const inputPreviewDiv = preview.querySelector(".input-preview");
    if (inputPreviewDiv) {
      inputPreviewDiv.innerHTML = renderMarkdown(content);
      preview.style.display = "block";
    }
  }
}

/**
 * Update the step result preview
 * @param {number} index - Step index
 * @param {string} result - Step result
 */
function updateStepResultPreview(index, result) {
  const preview = document.getElementById(`step-result-preview-${index}`);
  if (preview) {
    const resultPreviewDiv = preview.querySelector(".result-preview");
    if (resultPreviewDiv) {
      resultPreviewDiv.innerHTML = renderMarkdown(result);
      preview.style.display = "block";
    }
  }
}

/**
 * Update overall workflow status
 * @param {string} message - Status message
 * @param {string} type - Alert type (info, success, danger)
 */
function updateWorkflowStatus(message, type = "info") {
  const icon = type === "info" ? 
    '<i class="fas fa-spinner fa-spin"></i>' : 
    (type === "success" ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-exclamation-circle"></i>');
  
  const statusElement = document.getElementById("workflow-status");
  if (statusElement) {
    statusElement.className = `alert alert-${type} mb-3`;
    statusElement.innerHTML = `${icon} ${message}`;
  }
}

/**
 * Add final result buttons
 * @param {string} finalOutput - The final workflow output
 */
function addFinalResultButtons(finalOutput) {
  const buttonsHtml = `
    <button class="btn btn-outline-primary copy-result-btn">
      <i class="fas fa-copy"></i> Copy Final Result
    </button>
    <button class="btn btn-outline-success save-result-btn">
      <i class="fas fa-save"></i> Save as Paragraph
    </button>
  `;
  
  const actionsContainer = document.getElementById("final-result-actions");
  if (actionsContainer) {
    actionsContainer.innerHTML = buttonsHtml;
    actionsContainer.style.display = "block";
    
    // Add event handlers
    const copyBtn = actionsContainer.querySelector(".copy-result-btn");
    if (copyBtn) {
      copyBtn.addEventListener('click', function() {
        copyTextToClipboard(finalOutput);
        showNotification("Result copied to clipboard");
      });
    }
    
    const saveBtn = actionsContainer.querySelector(".save-result-btn");
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        saveResultAsParagraph(finalOutput);
        showNotification("Result saved as paragraph");
      });
    }
  }
}

/**
 * Prompt for user intervention during workflow
 * @param {number} stepIndex - Current step index
 * @param {string} stepName - Step name
 * @param {string} currentOutput - Current workflow output
 * @returns {Promise<boolean>} - Whether to continue
 */
function userIntervention(stepIndex, stepName, currentOutput) {
  return new Promise((resolve) => {
    // Create intervention UI
    const interventionHtml = `
      <div class="user-intervention p-3 mb-3 bg-light border rounded">
        <h5>User Intervention</h5>
        <p>Do you want to continue with this step? You can add additional context if needed.</p>
        
        ${currentOutput ? `
          <div class="mb-3">
            <h6>Current Output:</h6>
            <div class="current-output p-2 mb-2 bg-white border">
              ${renderMarkdown(currentOutput)}
            </div>
          </div>
        ` : ''}
        
        <div class="form-group">
          <label for="user-content-${stepIndex}">Additional Content (optional):</label>
          <textarea id="user-content-${stepIndex}" class="form-control" rows="3" placeholder="Add any additional context or instructions here..."></textarea>
        </div>
        
        <div class="btn-group">
          <button id="continue-btn-${stepIndex}" class="btn btn-success">Continue</button>
          <button id="skip-btn-${stepIndex}" class="btn btn-secondary">Skip Step</button>
          <button id="abort-btn-${stepIndex}" class="btn btn-danger">Stop Workflow</button>
        </div>
      </div>
    `;
    
    // Add to the step container
    const messageElement = document.getElementById(`step-message-${stepIndex}`);
    if (messageElement) {
      messageElement.innerHTML = interventionHtml;
      
      // Continue button
      const continueBtn = document.getElementById(`continue-btn-${stepIndex}`);
      if (continueBtn) {
        continueBtn.addEventListener('click', function() {
          const interventionElement = messageElement.querySelector('.user-intervention');
          if (interventionElement) {
            messageElement.removeChild(interventionElement);
          }
          resolve(true);
        });
      }
      
      // Skip button
      const skipBtn = document.getElementById(`skip-btn-${stepIndex}`);
      if (skipBtn) {
        skipBtn.addEventListener('click', function() {
          const interventionElement = messageElement.querySelector('.user-intervention');
          if (interventionElement) {
            messageElement.removeChild(interventionElement);
          }
          updateStepStatus(stepIndex, "skipped", "Step skipped by user");
          resolve(false);
        });
      }
      
      // Abort button
      const abortBtn = document.getElementById(`abort-btn-${stepIndex}`);
      if (abortBtn) {
        abortBtn.addEventListener('click', function() {
          const interventionElement = messageElement.querySelector('.user-intervention');
          if (interventionElement) {
            messageElement.removeChild(interventionElement);
          }
          updateStepStatus(stepIndex, "skipped", "Workflow stopped by user");
          resolve(false);
        });
      }
    } else {
      console.error(`Message element for step ${stepIndex} not found`);
      resolve(true); // Continue by default if we can't find the element
    }
  });
}

/**
 * Get blocks by tags
 * @param {Array} tags - Array of tags to filter by
 * @returns {Promise<Array>} - Blocks matching any of the tags
 */
function getBlocksByTags(tags) {
  return new Promise((resolve, reject) => {
    if (!db || !Array.isArray(tags) || tags.length === 0) {
      resolve([]);
      return;
    }
    
    const transaction = db.transaction("blocks", "readonly");
    const store = transaction.objectStore("blocks");
    const matchingBlocks = [];
    
    store.openCursor().onsuccess = function(e) {
      const cursor = e.target.result;
      if (cursor) {
        const block = cursor.value;
        
        // Check if block has any of the specified tags
        if (block.tags && block.tags.some(tag => tags.includes(tag))) {
          matchingBlocks.push(block);
        }
        
        cursor.continue();
      } else {
        resolve(matchingBlocks);
      }
    };
    
    transaction.onerror = function(e) {
      reject(e.target.error);
    };
  });
}

/**
 * Format blocks as text
 * @param {Array} blocks - Array of blocks
 * @returns {string} - Formatted text
 */
function formatBlocksAsText(blocks) {
  if (!blocks || blocks.length === 0) {
    return "";
  }
  
  return blocks.map(block => {
    const title = block.title || `Block ${block.id}`;
    return `## ${title}\n\n${block.text}`;
  }).join("\n\n---\n\n");
}

/**
 * Get action by ID
 * @param {number} actionId - The action ID
 * @returns {Promise<Object>} - The action object
 */
function getActionById(actionId) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not available"));
      return;
    }
    
    const transaction = db.transaction("actions", "readonly");
    const store = transaction.objectStore("actions");
    
    const request = store.get(parseInt(actionId));
    
    request.onsuccess = function(e) {
      resolve(e.target.result);
    };
    
    request.onerror = function(e) {
      reject(e.target.error);
    };
  });
}

/**
 * Add a workflow step
 */
function addWorkflowStep() {
  const stepHtml = createWorkflowStepHTML({}, $("#workflowSteps .workflow-step").length);
  $("#workflowSteps").append(stepHtml);
}

// Event Handlers - Call these in document.ready
$(document).ready(function() {
  // Add step button
  $("#addWorkflowStepBtn").on("click", addWorkflowStep);
  
  // Cancel button
  $("#cancelWorkflowBtn").on("click", resetWorkflowForm);
  
  // Form submission
  $("#workflowForm").on("submit", handleWorkflowFormSubmit);
  
  // Add workflow button
  $("#addWorkflowBtn").on("click", function() {
    resetWorkflowForm();
  });
});

