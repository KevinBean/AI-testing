/**
 * Workflows management module
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
  
  try {
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
  } catch (err) {
    console.error("Error loading workflows:", err);
    $("#workflowList").append('<li class="list-group-item text-danger">Error loading workflows. Please refresh the page.</li>');
  }
}

/**
 * Preview a workflow
 * @param {Object} workflow - The workflow to preview
 */
function previewWorkflow(workflow) {
  let html = `
    <h5>Configure & Execute: ${workflow.name}</h5>
    <p>${workflow.description || "<em>No description</em>"}</p>

     <div class="workflow-execution-container">
      <div class="alert alert-info">
        <i class="fas fa-info-circle"></i> Configure inputs for each step and execute them in sequence. You can save this configuration for future runs.
      </div>
      <div id="workflow-steps-container"></div>
      <div id="workflow-final-actions" class="text-center mt-3 p-3 border-top d-none">
        <h5>Workflow Complete</h5>
        <div class="btn-group">
          <button class="btn btn-outline-primary copy-workflow-result-btn">
            <i class="fas fa-copy"></i> Copy Final Result
          </button>
          <button class="btn btn-outline-success save-workflow-result-btn">
            <i class="fas fa-save"></i> Save as Paragraph
          </button>
        </div>
      </div>
    </div>
    
    <div class="mt-3 btn-group">
      <button class="btn btn-primary run-workflow-interactive-btn" data-workflow-id="${workflow.id}">
        <i class="fas fa-cogs"></i> Configure & Run Step-by-Step
      </button>
      <button class="btn btn-success run-workflow-straight-btn" data-workflow-id="${workflow.id}">
        <i class="fas fa-play"></i> Run Entire Workflow
      </button>
    </div>
  `;
  
  $("#workflowPreview").html(html);
  $("#runWorkflowBtn").prop("disabled", false);
  $("#runWorkflowBtn").data("workflow-id", workflow.id);
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
    const stepHtml = $(`
      <div class="workflow-step mb-3">
        <div class="form-group">
          <label>Step ${index + 1} Name</label>
          <input type="text" class="form-control step-name" value="${step.actionName || ''}" placeholder="Enter step name">
        </div>
        <div class="form-group">
          <label>Step ${index + 1} Description</label>
          <textarea class="form-control step-desc" rows="2" placeholder="Enter step description">${step.description || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Action</label>
          <select class="form-control step-action-id">
            <option value="">Select an action...</option>
          </select>
          <small class="form-text text-muted">If no actions are listed, ensure actions are created in the Actions tab.</small>
        </div>
        <button type="button" class="btn btn-danger btn-sm remove-step-btn">Remove Step</button>
      </div>
    `);

    const transaction = db.transaction("actions", "readonly");
    const store = transaction.objectStore("actions");
    store.openCursor().onsuccess = function (e) {
      const cursor = e.target.result;
      if (cursor) {
        const action = cursor.value;
        stepHtml.find(".step-action-id").append(
          `<option value="${action.id}" ${action.id === step.actionId ? 'selected' : ''}>${action.title}</option>`
        );
        cursor.continue();
      }
    };

    stepHtml.find(".remove-step-btn").click(function () {
      stepHtml.remove();
    });

    $("#workflowSteps").append(stepHtml);
  });

  $("#workflowForm button[type=submit]").text("Update Workflow");
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
    const actionName = $(this).find(".step-name").val().trim();
    const description = $(this).find(".step-desc").val().trim();
    const actionId = parseInt($(this).find(".step-action-id").val());
    
    if (actionName) {
      steps.push({
        actionName,
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
      created: new Date()
    };
    
    store.add(workflow).onsuccess = function() {
      showNotification("New workflow created!");
      resetWorkflowForm();
      loadWorkflows();
    };
  }
}

/**
 * Run a workflow
 * @param {number} workflowId - The workflow ID
 * @param {string} mode - Run mode: 'interactive' or 'straight'
 */
function runWorkflow(workflowId, mode) {
  if (!db) {
    showNotification("Database not available. Please refresh the page.", "danger");
    return;
  }
  
  const transaction = db.transaction("workflows", "readonly");
  const store = transaction.objectStore("workflows");
  
  if (!workflowId) {
    showNotification("Invalid workflow ID", "danger");
    return;
  }
  
  try {
    const id = Number(workflowId);
    if (isNaN(id)) {
      throw new Error("Workflow ID must be a number");
    }
    
    store.get(id).onsuccess = function(e) {
      const workflow = e.target.result;
      if (!workflow) {
        showNotification("Workflow not found", "danger");
        return;
      }
      
      if (!workflow.steps || workflow.steps.length === 0) {
        showNotification("This workflow has no steps to run", "warning");
        return;
      }
      
      if (!workflow.configuredInputs) {
        workflow.configuredInputs = workflow.steps.map(() => ({ 
          custom: { enabled: true, content: '' },
          previous: { enabled: false },
          selected: { enabled: false, items: [] }
        }));
      } else {
        workflow.configuredInputs = workflow.configuredInputs.map(input => {
          if (input.type) {
            const newFormat = {
              custom: { enabled: input.type === 'custom', content: input.content || '' },
              previous: { enabled: input.type === 'previous' },
              selected: { enabled: input.type === 'selected', items: input.selectedItems || [] }
            };
            return newFormat;
          }
          return input;
        });
      }
      
      if (mode === 'interactive') {
        showWorkflowExecutionModal(workflow);
      } else if (mode === 'straight') {
        $("#workflowResultContainer").html('<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Running entire workflow...</div>');
        
        runEntireWorkflow(workflow);
      }
    };
  } catch (error) {
    console.error("Error running workflow:", error);
    showNotification("Error: " + error.message, "danger");
  }
}

/**
 * Run an entire workflow at once
 * @param {Object} workflow - The workflow to run
 */
async function runEntireWorkflow(workflow) {
  let currentContent = "";
  let stepResults = [];
  
  try {
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const configuredInput = workflow.configuredInputs && workflow.configuredInputs[i] 
        ? workflow.configuredInputs[i] 
        : { 
            custom: { enabled: true, content: '' },
            previous: { enabled: false },
            selected: { enabled: false, items: [] }
          };
      
      if (!step.actionId) {
        stepResults.push({
          step: i + 1,
          name: step.actionName || `Step ${i + 1}`,
          status: "skipped",
          message: "No action selected for this step"
        });
        continue;
      }
      
      $("#workflowResultContainer").html(`
        <div class="text-center">
          <i class="fas fa-spinner fa-spin"></i> 
          Running step ${i + 1} of ${workflow.steps.length}: ${step.actionName}...
        </div>
      `);
      
      let inputContent = [];
      
      if (configuredInput.custom && configuredInput.custom.enabled) {
        const customText = configuredInput.custom.content || $("#workflowTestInput").val().trim();
        if (customText) {
          inputContent.push({
            source: "Custom Input",
            content: customText
          });
        }
      }
      
      if (i > 0 && configuredInput.previous && configuredInput.previous.enabled && currentContent) {
        inputContent.push({
          source: "Previous Step Result",
          content: currentContent
        });
      }
      
      if (configuredInput.selected && configuredInput.selected.enabled && 
          configuredInput.selected.items && configuredInput.selected.items.length > 0) {
        try {
          const selectedContent = await assembleContentFromConfiguredItems(configuredInput.selected.items);
          if (selectedContent) {
            inputContent.push({
              source: "Selected Content",
              content: selectedContent
            });
          }
        } catch (error) {
          console.error("Error assembling content:", error);
        }
      }
      
      const combinedInput = inputContent.map(item => 
        `## ${item.source}\n${item.content}`
      ).join("\n\n---\n\n");
      
      const finalInput = combinedInput || "";
      
      const actionTx = db.transaction("actions", "readonly");
      const actionStore = actionTx.objectStore("actions");
      
      try {
        const getActionPromise = new Promise((resolve, reject) => {
          const request = actionStore.get(parseInt(step.actionId));
          request.onsuccess = function(e) {
            resolve(e.target.result);
          };
          request.onerror = function(e) {
            reject(e.target.error);
          };
        });
        
        const action = await getActionPromise;
        
        if (!action) {
          stepResults.push({
            step: i + 1,
            name: step.actionName || `Step ${i + 1}`,
            status: "error",
            message: "Action not found"
          });
          continue;
        }
        
        const processedPrompt = action.prompt.replace(/{content}/g, finalInput || "");
        
        const result = await callOpenAiApi(action, processedPrompt);
        
        currentContent = result;
        
        stepResults.push({
          step: i + 1,
          name: step.actionName || `Step ${i + 1}`,
          status: "success",
          result: result
        });
      } catch (error) {
        stepResults.push({
          step: i + 1,
          name: step.actionName || `Step ${i + 1}`,
          status: "error",
          message: error.message || "Error executing this step"
        });
        
        break;
      }
    }
    
    displayWorkflowResults(stepResults, currentContent);
    
  } catch (error) {
    $("#workflowResultContainer").html(`
      <div class="alert alert-danger">
        <strong>Error:</strong> ${error.message || "An error occurred while running the workflow"}
      </div>
    `);
  }
}

/**
 * Display workflow results
 * @param {Array} stepResults - Array of step results
 * @param {string} finalResult - Final result
 */
function displayWorkflowResults(stepResults, finalResult) {
  let html = '<div class="card"><div class="card-header">Workflow Results</div><div class="card-body">';
  
  stepResults.forEach(result => {
    html += `<div class="mb-3">
      <h6>Step ${result.step}: ${result.name}</h6>
      <p>Status: <span class="badge badge-${result.status === 'success' ? 'success' : 'danger'}">${result.status}</span></p>
      ${result.result ? `<div class="bg-light p-2 border rounded">${renderMarkdown(result.result)}</div>` : ''}
      ${result.message ? `<p class="text-danger">${result.message}</p>` : ''}
    </div>`;
  });
  
  html += `<div class="mt-3">
    <h5>Final Result:</h5>
    <div class="bg-light p-2 border rounded">${renderMarkdown(finalResult)}</div>
    <div class="mt-3">
      <button class="btn btn-sm btn-outline-primary copy-result-btn">
        <i class="fas fa-copy"></i> Copy Results
      </button>
      <button class="btn btn-sm btn-outline-success save-result-btn">
        <i class="fas fa-save"></i> Save as Paragraph
      </button>
    </div>
  </div>`;
  
  html += '</div></div>';
  $("#workflowResultContainer").html(html);
  renderMermaidIn("#workflowResultContainer .mermaid");
  
  // Add event handlers for the buttons
  $(".copy-result-btn").click(function() {
    copyTextToClipboard(finalResult);
  });
  
  $(".save-result-btn").click(function() {
    saveResultAsParagraph(finalResult);
  });
}

/**
 * Show the workflow execution modal
 * @param {Object} workflow - The workflow to execute
 */
function showWorkflowExecutionModal(workflow) {
  // Create a modal for workflow execution if it doesn't exist
  if (!$('#workflow-execution-modal').length) {
    const modal = $(`
      <div class="modal fade" id="workflow-execution-modal" tabindex="-1" role="dialog">
        <div class="modal-dialog modal-xl" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="workflowExecutionModalLabel">Configure & Execute Workflow</h5>
              <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div class="modal-body">
              <div id="workflow-modal-content"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
              <button type="button" class="btn btn-primary" id="save-workflow-config-btn">Save Configuration</button>
            </div>
          </div>
        </div>
      </div>
    `).appendTo('body');
    
    // Add event handlers for the buttons
    $('#save-workflow-config-btn').click(function() {
      const workflow = $('#workflow-execution-modal').data('current-workflow');
      if (workflow) {
        saveWorkflowConfiguration(workflow);
      }
    });
    
    // Handle modal closing
    modal.on('hidden.bs.modal', function() {
      // Clean up
    });
  }
  
  $('#workflow-execution-modal').data('current-workflow', workflow);
  
  $('#workflowExecutionModalLabel').text(`Configure & Execute: ${workflow.name}`);
  
  // Build the workflow steps UI
  let stepsHtml = `
    <div class="alert alert-info">
      <i class="fas fa-info-circle"></i> Configure inputs for each step and execute them in sequence.
    </div>
  `;
  
  workflow.steps.forEach((step, index) => {
    const isFirstStep = index === 0;
    const configuredInput = workflow.configuredInputs && workflow.configuredInputs[index] 
      ? workflow.configuredInputs[index] 
      : { 
          custom: { enabled: true, content: '' },
          previous: { enabled: false },
          selected: { enabled: false, items: [] }
        };
    
    stepsHtml += `
      <div class="card mb-3 workflow-step-card ${!isFirstStep ? 'disabled' : ''}" id="workflow-step-${index}-container" data-step-index="${index}">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h6 class="mb-0">Step ${index + 1}: ${step.actionName || "Unnamed Step"}</h6>
          <span class="step-status">
            ${isFirstStep ? '<span class="badge badge-secondary">Ready</span>' : '<span class="badge badge-light">Waiting</span>'}
          </span>
        </div>
        <div class="card-body">
          ${step.description ? `<p class="text-muted">${step.description}</p>` : ''}
          
          <div class="form-group">
            <label>Input for this step:</label>
            <p class="text-muted small">Select one or more input sources to combine for this step.</p>
            
            <div class="input-options-container">
              <div class="custom-control custom-checkbox mb-2">
                <input type="checkbox" id="step-${index}-custom-checkbox" class="custom-control-input step-input-checkbox" 
                  data-input-type="custom" ${configuredInput.custom && configuredInput.custom.enabled ? 'checked' : ''}>
                <label class="custom-control-label" for="step-${index}-custom-checkbox">Custom Input</label>
              </div>
            
              <textarea class="form-control mb-3" id="step-${index}-custom-input" rows="3" 
                placeholder="Enter custom input for this step" 
                ${!(configuredInput.custom && configuredInput.custom.enabled) ? 'disabled' : ''}>
                ${configuredInput.custom && configuredInput.custom.content ? configuredInput.custom.content : 
                  (isFirstStep ? $('#workflowTestInput').val() : '')}
              </textarea>
              
              ${!isFirstStep ? `
              <div class="custom-control custom-checkbox mb-2">
                <input type="checkbox" id="step-${index}-previous-checkbox" class="custom-control-input step-input-checkbox" 
                  data-input-type="previous" ${configuredInput.previous && configuredInput.previous.enabled ? 'checked' : ''} 
                  ${isFirstStep ? 'disabled' : ''}>
                <label class="custom-control-label" for="step-${index}-previous-checkbox">Use Previous Step Result</label>
              </div>
              
              <div class="bg-light p-2 border rounded mb-3 previous-content-container ${!(configuredInput.previous && configuredInput.previous.enabled) ? 'd-none' : ''}">
                <pre class="mb-0" id="step-${index}-previous-content"><em>Previous step hasn't been executed yet</em></pre>
              </div>
              ` : ''}
              
              <div class="custom-control custom-checkbox mb-2">
                <input type="checkbox" id="step-${index}-select-checkbox" class="custom-control-input step-input-checkbox" 
                  data-input-type="selected" ${configuredInput.selected && configuredInput.selected.enabled ? 'checked' : ''}>
                <label class="custom-control-label" for="step-${index}-select-checkbox">Select Content from System</label>
              </div>
              
              <div class="selected-content-container mb-3 ${!(configuredInput.selected && configuredInput.selected.enabled) ? 'd-none' : ''}">
                <button class="btn btn-outline-primary select-content-btn" data-step-index="${index}">
                  <i class="fas fa-list"></i> Select Content Items
                </button>
                
                <div class="mt-2 selected-items-summary">
                  ${configuredInput.selected && configuredInput.selected.items && configuredInput.selected.items.length ? 
                    `<small class="text-muted">${configuredInput.selected.items.length} item(s) selected</small>` : 
                    '<small class="text-muted">No items selected</small>'}
                </div>
              </div>
            </div>
            
            <button class="btn btn-primary" id="run-step-${index}-btn" ${!isFirstStep ? 'disabled' : ''}>
              Execute Step ${index + 1}
            </button>
          </div>
          
          <div class="step-result"></div>
        </div>
      </div>
    `;
  });
  
  stepsHtml += `
    <div id="workflow-final-actions" class="text-center mt-3 p-3 border-top d-none">
      <h5>Workflow Complete</h5>
      <div class="btn-group">
        <button class="btn btn-outline-primary copy-workflow-result-btn">
          <i class="fas fa-copy"></i> Copy Final Result
        </button>
        <button class="btn btn-outline-success save-workflow-result-btn">
          <i class="fas fa-save"></i> Save as Paragraph
        </button>
      </div>
    </div>
  `;
  
  $('#workflow-modal-content').html(stepsHtml);
  
  // Add event handlers for the UI elements
  workflow.steps.forEach((step, index) => {
    // Step input type checkboxes
    $(`#step-${index}-custom-checkbox`).change(function() {
      const isChecked = $(this).prop('checked');
      $(`#step-${index}-custom-input`).prop('disabled', !isChecked);
      updateStepConfiguration(index, workflow);
    });
    
    if (index > 0) {
      $(`#step-${index}-previous-checkbox`).change(function() {
        const isChecked = $(this).prop('checked');
        $(`#workflow-step-${index}-container .previous-content-container`).toggleClass('d-none', !isChecked);
        updateStepConfiguration(index, workflow);
      });
    }
    
    $(`#step-${index}-select-checkbox`).change(function() {
      const isChecked = $(this).prop('checked');
      $(`#workflow-step-${index}-container .selected-content-container`).toggleClass('d-none', !isChecked);
      updateStepConfiguration(index, workflow);
    });
    
    // Select content button
    $(`#workflow-step-${index}-container .select-content-btn`).click(function() {
      selectContentForStep(workflow, index);
    });
    
    // Run step button
    $(`#run-step-${index}-btn`).click(async function() {
      let inputContent = [];
      
      if ($(`#step-${index}-custom-checkbox`).is(':checked')) {
        const customText = $(`#step-${index}-custom-input`).val().trim();
        if (customText) {
          inputContent.push({
            source: "Custom Input",
            content: customText
          });
        }
      }
      
      if (index > 0 && $(`#step-${index}-previous-checkbox`).is(':checked')) {
        const previousContent = $(`#step-${index}-previous-content`).data('content');
        if (previousContent) {
          inputContent.push({
            source: "Previous Step Result",
            content: previousContent
          });
        }
      }
      
      if ($(`#step-${index}-select-checkbox`).is(':checked')) {
        const configuredInput = workflow.configuredInputs && workflow.configuredInputs[index];
        if (configuredInput && configuredInput.selected && configuredInput.selected.items && configuredInput.selected.items.length > 0) {
          try {
            const selectedContent = await assembleContentFromConfiguredItems(configuredInput.selected.items);
            if (selectedContent) {
              inputContent.push({
                source: "Selected Content",
                content: selectedContent
              });
            }
          } catch (error) {
            console.error("Error assembling content:", error);
            showNotification("Error loading selected content: " + error.message, "danger");
            return;
          }
        } else if ($(`#step-${index}-select-checkbox`).is(':checked')) {
          showNotification("No content items selected", "warning");
          return;
        }
      }
      
      const combinedInput = inputContent.map(item => 
        `## ${item.source}\n${item.content}`
      ).join("\n\n---\n\n");
      
      await executeWorkflowStep(step, combinedInput, workflow, index);
    });
  });
  
  $('#workflow-execution-modal').modal('show');
}

/**
 * Update the step configuration
 * @param {number} stepIndex - The step index
 * @param {Object} workflow - The workflow
 */
function updateStepConfiguration(stepIndex, workflow) {
  if (!workflow.configuredInputs) {
    workflow.configuredInputs = workflow.steps.map(() => ({ 
      custom: { enabled: true, content: '' },
      previous: { enabled: false },
      selected: { enabled: false, items: [] }
    }));
  }
  
  const isFirstStep = stepIndex === 0;
  
  const customCheckbox = $(`#step-${stepIndex}-custom-checkbox`);
  const customInput = $(`#step-${stepIndex}-custom-input`);
  const previousCheckbox = !isFirstStep ? $(`#step-${stepIndex}-previous-checkbox`) : null;
  const selectedCheckbox = $(`#step-${stepIndex}-select-checkbox`);
  
  workflow.configuredInputs[stepIndex] = {
    custom: {
      enabled: customCheckbox.is(':checked'),
      content: customInput.val().trim()
    },
    previous: {
      enabled: !isFirstStep && previousCheckbox ? previousCheckbox.is(':checked') : false
    },
    selected: {
      enabled: selectedCheckbox.is(':checked'),
      items: (workflow.configuredInputs[stepIndex] && 
             workflow.configuredInputs[stepIndex].selected && 
             workflow.configuredInputs[stepIndex].selected.items) || []
    }
  };
  
  $('#workflow-execution-modal').data('current-workflow', workflow);
}

/**
 * Execute a workflow step
 * @param {Object} step - The step to execute
 * @param {string} inputContent - The input content
 * @param {Object} workflow - The workflow
 * @param {number} stepIndex - The step index
 * @returns {Promise<Object>} - The step result
 */
async function executeWorkflowStep(step, inputContent, workflow, stepIndex) {
  const stepContainer = $(`#workflow-step-${stepIndex}-container`);
  
  stepContainer.find('.step-status')
    .html('<span class="badge badge-info"><i class="fas fa-spinner fa-spin"></i> Running...</span>');
  
  try {
    if (!db) {
      throw new Error("Database not available");
    }
    
    const actionTx = db.transaction("actions", "readonly");
    const actionStore = actionTx.objectStore("actions");
    
    const getActionPromise = new Promise((resolve, reject) => {
      const request = actionStore.get(parseInt(step.actionId));
      request.onsuccess = function(e) {
        resolve(e.target.result);
      };
      request.onerror = function(e) {
        reject(e.target.error);
      };
    });
    
    const action = await getActionPromise;
    
    if (!action) {
      stepContainer.find('.step-status')
        .html('<span class="badge badge-danger">Error: Action not found</span>');
      return { status: "error", message: "Action not found" };
    }
    
    const processedPrompt = action.prompt.replace(/{content}/g, inputContent || "");
    
    const result = await callOpenAiApi(action, processedPrompt);
    
    stepContainer.find('.step-status')
      .html('<span class="badge badge-success">Success</span>');
    
    const resultContainer = stepContainer.find('.step-result');
    resultContainer.html(`
      <div class="card mt-2">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span>Result</span>
          <div>
            <button class="btn btn-sm btn-outline-primary copy-step-result-btn">
              <i class="fas fa-copy"></i> Copy
            </button>
            <button class="btn btn-sm btn-outline-secondary toggle-step-result-btn">
              <i class="fas fa-eye-slash"></i> Hide
            </button>
          </div>
        </div>
        <div class="card-body step-result-content">
          <div class="bg-light p-2 border rounded result-content">${renderMarkdown(result)}</div>
        </div>
      </div>
    `);
    
    renderMermaidIn(resultContainer.find(".result-content .mermaid"));
    
    resultContainer.find('.toggle-step-result-btn').click(function() {
      const resultContent = $(this).closest('.card').find('.step-result-content');
      const btn = $(this);
      
      if (resultContent.is(':visible')) {
        resultContent.slideUp();
        btn.html('<i class="fas fa-eye"></i> Show');
      } else {
        resultContent.slideDown();
        btn.html('<i class="fas fa-eye-slash"></i> Hide');
      }
    });
    
    resultContainer.find('.copy-step-result-btn').click(function() {
      copyTextToClipboard(result);
      showNotification("Step result copied to clipboard!");
    });
    
    const nextStepIndex = stepIndex + 1;
    if (nextStepIndex < workflow.steps.length) {
      $(`#workflow-step-${nextStepIndex}-container`).removeClass('disabled');
      $(`#run-step-${nextStepIndex}-btn`).prop('disabled', false);
      
      $(`#step-${nextStepIndex}-previous-content`).text(result).data('content', result);
    }
    
    if (nextStepIndex === workflow.steps.length) {
      $('#workflow-final-actions').removeClass('d-none');
      $('#workflow-execution-modal').data('final-result', result);
      
      // Add event handlers for the final action buttons
      $('.copy-workflow-result-btn').click(function() {
        copyTextToClipboard(result);
        showNotification("Final result copied to clipboard!");
      });
      
      $('.save-workflow-result-btn').click(function() {
        saveResultAsParagraph(result);
        $('#workflow-execution-modal').modal('hide');
      });
    }
    
    return { status: "success", result: result };
  } catch (error) {
    console.error("Step execution error:", error);
    stepContainer.find('.step-status')
      .html(`<span class="badge badge-danger">Error: ${error.message || "Execution failed"}</span>`);
    return { status: "error", message: error.message || "Error executing this step" };
  }
}

/**
 * Select content for a workflow step
 * @param {Object} workflow - The workflow
 * @param {number} stepIndex - The step index
 */
function selectContentForStep(workflow, stepIndex) {
  selectedContentItems = (workflow.configuredInputs && 
                        workflow.configuredInputs[stepIndex] && 
                        workflow.configuredInputs[stepIndex].selected &&
                        workflow.configuredInputs[stepIndex].selected.items) || [];
                        
  $("#contentSelectionModalLabel").text("Select Content for Workflow Step");
  $(".action-selection-info").text("Select items to use as input for this workflow step");
  $("#contentSelectionModal").data("workflow-step-index", stepIndex);
  $("#contentSelectionModal").data("selection-mode", "multiple");
  
  $("#confirmContentSelection").text("Use Selected Items").off("click").on("click", function() {
    if (!workflow.configuredInputs) {
      workflow.configuredInputs = workflow.steps.map(() => ({ 
        custom: { enabled: true, content: '' },
        previous: { enabled: false },
        selected: { enabled: false, items: [] }
      }));
    }
    
    if (!workflow.configuredInputs[stepIndex]) {
      workflow.configuredInputs[stepIndex] = {
        custom: { enabled: true, content: '' },
        previous: { enabled: false },
        selected: { enabled: true, items: selectedContentItems }
      };
    } else {
      workflow.configuredInputs[stepIndex].selected = { 
        enabled: true,
        items: selectedContentItems 
      };
    }
    
    $('#workflow-execution-modal').data('current-workflow', workflow);
    
    $(`#workflow-step-${stepIndex}-container .selected-items-summary`).html(
      `<small class="text-muted">${selectedContentItems.length} item(s) selected</small>`
    );
    
    $("#contentSelectionModal").modal("hide");
  });
  
  loadBlocksForSelection();
  loadDocumentsForSelection();
  loadTagsForSelection();
  loadReferencesForSelection();
  
  $("#contentSelectionModal").modal("show");
}

/**
 * Save workflow configuration
 * @param {Object} workflow - The workflow to save configuration for
 */
function saveWorkflowConfiguration(workflow) {
  if (!db) {
    showNotification("Database not available. Please refresh the page.", "danger");
    return;
  }
  
  const transaction = db.transaction("workflows", "readwrite");
  const store = transaction.objectStore("workflows");
  
  store.get(workflow.id).onsuccess = function(e) {
    const existingWorkflow = e.target.result;
    if (existingWorkflow) {
      existingWorkflow.configuredInputs = workflow.configuredInputs;
      existingWorkflow.updated = new Date();
      
      store.put(existingWorkflow).onsuccess = function() {
        showNotification("Workflow configuration saved successfully!");
      };
    } else {
      showNotification("Could not find workflow to save configuration", "warning");
    }
  };
}

/**
 * Assemble content from configured items
 * @param {Array} selectedItems - The selected items
 * @returns {Promise<string>} - The assembled content
 */
async function assembleContentFromConfiguredItems(selectedItems) {
  return await assembleContentFromSelectedItems();
}

/**
 * Add a workflow step to the form
 */
function addWorkflowStep() {
  const stepHtml = $(`
    <div class="workflow-step mb-3">
      <div class="form-group">
        <label>Step Name</label>
        <input type="text" class="form-control step-name" placeholder="Enter step name">
      </div>
      <div class="form-group">
        <label>Step Description</label>
        <textarea class="form-control step-desc" rows="2" placeholder="Enter step description"></textarea>
      </div>
      <div class="form-group">
        <label>Action</label>
        <select class="form-control step-action-id">
          <option value="">Select an action...</option>
        </select>
        <small class="form-text text-muted">If no actions are listed, ensure actions are created in the Actions tab.</small>
      </div>
      <button type="button" class="btn btn-danger btn-sm remove-step-btn">Remove Step</button>
    </div>
  `);

  if (!db) {
    stepHtml.find(".step-action-id").append('<option value="" disabled>Database not available</option>');
  } else {
    const transaction = db.transaction("actions", "readonly");
    const store = transaction.objectStore("actions");
    store.openCursor().onsuccess = function (e) {
      const cursor = e.target.result;
      if (cursor) {
        const action = cursor.value;
        stepHtml.find(".step-action-id").append(
          `<option value="${action.id}">${action.title}</option>`
        );
        cursor.continue();
      }
    };
  }

  stepHtml.find(".remove-step-btn").click(function () {
    stepHtml.remove();
  });

  $("#workflowSteps").append(stepHtml);
}