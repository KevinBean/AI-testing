// Workflow Management Functions

let editingWorkflowId = null;

// Make sure we have jQuery and bind the event as soon as possible
function initWorkflowBindings() {
  console.log("Initializing workflow bindings...");
  
  if (typeof $ === 'undefined') {
    console.error("jQuery not available yet - will try again in 500ms");
    setTimeout(initWorkflowBindings, 500);
    return;
  }
  
  console.log("jQuery available, binding events");
  
  // Add workflow step button - using direct DOM approach first
  const addBtn = document.getElementById('addWorkflowStepBtn');
  if (addBtn) {
    console.log("Add Workflow Step button found in DOM");
    addBtn.addEventListener('click', function() {
      console.log("Add workflow step button clicked (DOM event)");
      addWorkflowStep();
    });
  } else {
    console.warn("Add Workflow Step button not found in DOM directly");
  }
  
  // Also try jQuery binding approach
  if ($("#addWorkflowStepBtn").length) {
    console.log("Add Workflow Step button found via jQuery");
    
    // Unbind first to avoid duplicate handlers
    $("#addWorkflowStepBtn").off('click').on('click', function() {
      console.log("Add workflow step button clicked (jQuery event)");
      addWorkflowStep();
    });
  } else {
    console.warn("Add Workflow Step button not found via jQuery");
  }
  
  // Other button bindings
  $("#cancelWorkflowBtn").off('click').on('click', function() {
    console.log("Cancel workflow button clicked");
    resetWorkflowForm();
  });
  
  $("#workflowSearch").off('keyup').on('keyup', function() {
    const searchTerm = $(this).val().trim();
    loadWorkflows(searchTerm);
  });
  
  $("#workflowForm").off('submit').on('submit', function(e) {
    e.preventDefault();
    console.log("Workflow form submitted");
    handleWorkflowFormSubmit();
  });
  
  console.log("Workflow bindings initialized");
}

// Call initialization immediately
initWorkflowBindings();

// Also add it to document ready
$(document).ready(function() {
  console.log("Document ready, initializing workflow bindings");
  initWorkflowBindings();
  
  // Load workflows when the tab is shown
  $('a[data-toggle="tab"][href="#workflowsView"]').on('shown.bs.tab', function (e) {
    console.log("Workflows tab shown");
    loadWorkflows();
  });
});

// Load saved workflows
function loadWorkflows(searchTerm = "") {
  $("#workflowList").empty();
  
  // Check if database is available
  if (!db || db.version === null) {
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
        const searchableText = (workflow.name + " " + workflow.description).toLowerCase();
        
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
    console.error("Database error:", err);
    $("#workflowList").append('<li class="list-group-item text-danger">Database not available. Please refresh the page.</li>');
  }
}

// Add a new workflow step to the form
function addWorkflowStep() {
  console.log("addWorkflowStep function called");
  
  // Debugging display
  $("#debug-info").show().html('<div class="alert alert-info">Loading actions...</div>');
  
  // Remove the empty steps message if it exists
  $("#emptyStepsMessage").remove();
  
  // Show loading indicator
  $("#workflowSteps").append('<div class="text-center py-2" id="loading-actions"><i class="fas fa-spinner fa-spin"></i> Loading actions...</div>');
  
  try {
    // Check if db is defined
    if (!window.db) {
      throw new Error("Database not initialized");
    }
    
    // Create a promise-based wrapper for the IndexedDB transaction
    const getActionsPromise = new Promise((resolve, reject) => {
      try {
        const actions = [];
        const transaction = db.transaction("actions", "readonly");
        const store = transaction.objectStore("actions");
        
        console.log("Fetching actions from database...");
        const request = store.openCursor();
        
        request.onsuccess = function(e) {
          const cursor = e.target.result;
          if (cursor) {
            actions.push(cursor.value);
            cursor.continue();
          } else {
            console.log(`Found ${actions.length} actions`);
            resolve(actions);
          }
        };
        
        request.onerror = function(e) {
          console.error("Error accessing actions store:", e.target.error);
          reject(e.target.error);
        };
        
        transaction.onerror = function(e) {
          console.error("Transaction error:", e.target.error);
          reject(e.target.error);
        };
      } catch (error) {
        console.error("Exception in getActionsPromise:", error);
        reject(error);
      }
    });
  
    // Process the results from the promise
    getActionsPromise.then(actions => {
      // Remove the loading indicator
      $("#loading-actions").remove();
      $("#debug-info").html(`<div class="alert alert-success">Successfully loaded ${actions.length} actions</div>`);
      
      if (actions.length === 0) {
        $("#workflowSteps").append(`
          <div class="alert alert-warning">
            <strong>No actions available!</strong> Please create at least one action first.
            <a href="#actionsView" class="alert-link" data-toggle="tab">Go to Actions</a>
          </div>
        `);
        return;
      }
      
      // Create options for action selection
      let actionOptions = actions.map(action => 
        `<option value="${action.id}">${action.title || 'Untitled Action'}</option>`
      ).join('');
      
      const stepIndex = $("#workflowSteps .workflow-step").length;
      const stepHtml = `
        <div class="workflow-step card mb-2" data-step-index="${stepIndex}">
          <div class="card-body">
            <div class="d-flex justify-content-between mb-2">
              <h6>Step ${stepIndex + 1}</h6>
              <div class="btn-group btn-group-sm">
                <button type="button" class="btn btn-outline-secondary move-step-up-btn"><i class="fas fa-arrow-up"></i></button>
                <button type="button" class="btn btn-outline-secondary move-step-down-btn"><i class="fas fa-arrow-down"></i></button>
                <button type="button" class="btn btn-outline-danger remove-step-btn"><i class="fas fa-trash"></i></button>
              </div>
            </div>
            
            <div class="form-row">
              <div class="col-md-6">
                <div class="form-group">
                  <label>Action</label>
                  <select class="form-control step-action-id" required>
                    <option value="">Select an action...</option>
                    ${actionOptions}
                  </select>
                </div>
              </div>
              <div class="col-md-6">
                <div class="form-group">
                  <label>Input Source</label>
                  <select class="form-control step-input-source">
                    <option value="previous">Output from previous step</option>
                    <option value="original">Original input</option>
                    <option value="custom">Custom input</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div class="form-group custom-input-container" style="display:none;">
              <label>Custom Input</label>
              <textarea class="form-control step-custom-input" rows="3" placeholder="Enter custom input for this step"></textarea>
              <small class="form-text text-muted">Use {previous} to insert the output from the previous step</small>
            </div>
          </div>
        </div>
      `;
      
      $("#workflowSteps").append(stepHtml);
      
      // Set up event handlers for the new step
      const $newStep = $("#workflowSteps .workflow-step").last();
      
      // Input source change handler
      $newStep.find(".step-input-source").on("change", function() {
        const customInputContainer = $(this).closest(".workflow-step").find(".custom-input-container");
        if ($(this).val() === "custom") {
          customInputContainer.slideDown();
        } else {
          customInputContainer.slideUp();
        }
      });
      
      // Move up button
      $newStep.find(".move-step-up-btn").on("click", function() {
        const currentStep = $(this).closest(".workflow-step");
        const prevStep = currentStep.prev(".workflow-step");
        if (prevStep.length) {
          currentStep.insertBefore(prevStep);
          updateStepNumbers();
        }
      });
      
      // Move down button
      $newStep.find(".move-step-down-btn").on("click", function() {
        const currentStep = $(this).closest(".workflow-step");
        const nextStep = currentStep.next(".workflow-step");
        if (nextStep.length) {
          currentStep.insertAfter(nextStep);
          updateStepNumbers();
        }
      });
      
      // Remove button
      $newStep.find(".remove-step-btn").on("click", function() {
        if (confirm("Are you sure you want to remove this step?")) {
          $(this).closest(".workflow-step").remove();
          updateStepNumbers();
          
          // If no steps remain, add the empty message back
          if ($("#workflowSteps .workflow-step").length === 0) {
            $("#workflowSteps").append('<p class="text-muted text-center my-3" id="emptyStepsMessage">No steps added yet. Click "Add Step" to begin.</p>');
          }
        }
      });
    }).catch(error => {
      $("#loading-actions").remove();
      $("#debug-info").show().html(`<div class="alert alert-danger">Error: ${error.message}</div>`);
      
      $("#workflowSteps").append(`
        <div class="alert alert-danger">
          <strong>Error:</strong> ${error.message || "Failed to load actions. Please try again."}
        </div>
      `);
      console.error("Error in addWorkflowStep:", error);
    });
  } catch (error) {
    $("#loading-actions").remove();
    $("#debug-info").show().html(`<div class="alert alert-danger">Exception: ${error.message}</div>`);
    
    $("#workflowSteps").append(`
      <div class="alert alert-danger">
        <strong>Exception:</strong> ${error.message || "An unexpected error occurred"}
      </div>
    `);
    console.error("Exception in addWorkflowStep:", error);
  }
}

// Update step numbers after reordering
function updateStepNumbers() {
  $("#workflowSteps .workflow-step").each(function(index) {
    $(this).attr("data-step-index", index);
    $(this).find("h6").text(`Step ${index + 1}`);
  });
}

// Handle workflow form submission
function handleWorkflowFormSubmit() {
  const name = $("#workflowName").val().trim();
  const description = $("#workflowDesc").val().trim();
  
  // Collect steps data
  const steps = [];
  $("#workflowSteps .workflow-step").each(function() {
    const actionId = $(this).find(".step-action-id").val();
    const inputSource = $(this).find(".step-input-source").val();
    const customInput = $(this).find(".step-custom-input").val();
    
    if (actionId) {
      steps.push({
        actionId: parseInt(actionId),
        inputSource: inputSource,
        customInput: inputSource === "custom" ? customInput : ""
      });
    }
  });
  
  if (steps.length === 0) {
    showNotification("Please add at least one step to the workflow", "warning");
    return;
  }
  
  const transaction = db.transaction("workflows", "readwrite");
  const store = transaction.objectStore("workflows");
  
  if (editingWorkflowId) {
    store.get(editingWorkflowId).onsuccess = function(e) {
      let workflow = e.target.result;
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

// Reset workflow form
function resetWorkflowForm() {
  editingWorkflowId = null;
  $("#workflowForm")[0].reset();
  $("#workflowSteps").empty();
  $("#saveWorkflowBtn").text("Save Workflow");
}

// Preview workflow
function previewWorkflow(workflow) {
  // Fetch action details for each step
  const steps = workflow.steps || [];
  let pendingSteps = steps.length;
  const actionDetails = {};
  
  if (steps.length === 0) {
    renderWorkflowPreview(workflow, {});
    return;
  }
  
  steps.forEach(step => {
    const transaction = db.transaction("actions", "readonly");
    const store = transaction.objectStore("actions");
    
    store.get(parseInt(step.actionId)).onsuccess = function(e) {
      const action = e.target.result;
      
      if (action) {
        actionDetails[step.actionId] = {
          title: action.title,
          description: action.description,
          model: action.model
        };
      }
      
      pendingSteps--;
      if (pendingSteps === 0) {
        renderWorkflowPreview(workflow, actionDetails);
      }
    };
  });
}

// Render workflow preview with action details
function renderWorkflowPreview(workflow, actionDetails) {
  let html = `
    <h5>${workflow.name}</h5>
    <p>${workflow.description || "<em>No description</em>"}</p>
    
    <div class="workflow-steps-preview">
      <h6>Workflow Steps:</h6>
      ${workflow.steps && workflow.steps.length > 0 ? '' : '<p class="text-muted">This workflow has no steps defined.</p>'}
  `;
  
  if (workflow.steps && workflow.steps.length > 0) {
    workflow.steps.forEach((step, index) => {
      const action = actionDetails[step.actionId] || { title: "Unknown Action", model: "Unknown Model" };
      
      html += `
        <div class="card mb-2">
          <div class="card-header">
            Step ${index + 1}: ${action.title}
          </div>
          <div class="card-body">
            <div><strong>Model:</strong> ${action.model}</div>
            <div><strong>Input Source:</strong> ${step.inputSource === "previous" ? "Output from previous step" : 
                           step.inputSource === "original" ? "Original input" : "Custom input"}</div>
            ${step.inputSource === "custom" && step.customInput ? 
              `<div class="mt-2"><strong>Custom Input:</strong><br><pre class="bg-light p-2 border rounded">${step.customInput}</pre></div>` : ''}
          </div>
        </div>
      `;
    });
    
    html += `
      <div class="mt-3">
        <button class="btn btn-primary run-workflow-straight-btn" data-workflow-id="${workflow.id}">
          <i class="fas fa-play"></i> Run Entire Workflow
        </button>
        <button class="btn btn-outline-primary run-workflow-interactive-btn" data-workflow-id="${workflow.id}">
          <i class="fas fa-step-forward"></i> Configure & Run Step-by-Step
        </button>
      </div>
    `;
  }
  
  html += `</div>`;
  
  $("#workflowPreview").html(html);
  
  // Add event handlers for run buttons
  $(".run-workflow-straight-btn").on("click", function() {
    const workflowId = $(this).data("workflow-id");
    runWorkflow(workflowId, "straight");
  });
  
  $(".run-workflow-interactive-btn").on("click", function() {
    const workflowId = $(this).data("workflow-id");
    runWorkflow(workflowId, "interactive");
  });
}

// Edit workflow
function editWorkflow(workflow) {
  editingWorkflowId = workflow.id;
  $("#workflowName").val(workflow.name);
  $("#workflowDesc").val(workflow.description || "");
  
  // Clear existing steps
  $("#workflowSteps").empty();
  
  // Add each step from the workflow
  if (workflow.steps && workflow.steps.length > 0) {
    // First, fetch all actions to populate dropdowns
    const transaction = db.transaction("actions", "readonly");
    const store = transaction.objectStore("actions");
    const actions = [];
    
    store.openCursor().onsuccess = function(e) {
      const cursor = e.target.result;
      if (cursor) {
        actions.push(cursor.value);
        cursor.continue();
      } else {
        // Once all actions are loaded, create the steps
        workflow.steps.forEach((step, index) => {
          // Create options for action selection
          let actionOptions = actions.map(action => 
            `<option value="${action.id}" ${action.id === step.actionId ? 'selected' : ''}>${action.title}</option>`
          ).join('');
          
          const stepHtml = `
            <div class="workflow-step card mb-2" data-step-index="${index}">
              <div class="card-body">
                <div class="d-flex justify-content-between mb-2">
                  <h6>Step ${index + 1}</h6>
                  <div class="btn-group btn-group-sm">
                    <button type="button" class="btn btn-outline-secondary move-step-up-btn"><i class="fas fa-arrow-up"></i></button>
                    <button type="button" class="btn btn-outline-secondary move-step-down-btn"><i class="fas fa-arrow-down"></i></button>
                    <button type="button" class="btn btn-outline-danger remove-step-btn"><i class="fas fa-trash"></i></button>
                  </div>
                </div>
                
                <div class="form-row">
                  <div class="col-md-6">
                    <div class="form-group">
                      <label>Action</label>
                      <select class="form-control step-action-id" required>
                        <option value="">Select an action...</option>
                        ${actionOptions}
                      </select>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="form-group">
                      <label>Input Source</label>
                      <select class="form-control step-input-source">
                        <option value="previous" ${step.inputSource === "previous" ? 'selected' : ''}>Output from previous step</option>
                        <option value="original" ${step.inputSource === "original" ? 'selected' : ''}>Original input</option>
                        <option value="custom" ${step.inputSource === "custom" ? 'selected' : ''}>Custom input</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div class="form-group custom-input-container" style="${step.inputSource === 'custom' ? '' : 'display:none;'}">
                  <label>Custom Input</label>
                  <textarea class="form-control step-custom-input" rows="3" placeholder="Enter custom input for this step">${step.customInput || ''}</textarea>
                  <small class="form-text text-muted">Use {previous} to insert the output from the previous step</small>
                </div>
              </div>
            </div>
          `;
          
          // Add the step to the form
          $("#workflowSteps").append(stepHtml);
          
          // Set up event handlers for this step
          const $step = $("#workflowSteps .workflow-step").last();
          
          // Input source change handler
          $step.find(".step-input-source").on("change", function() {
            const customInputContainer = $(this).closest(".workflow-step").find(".custom-input-container");
            if ($(this).val() === "custom") {
              customInputContainer.slideDown();
            } else {
              customInputContainer.slideUp();
            }
          });
          
          // Move up button
          $step.find(".move-step-up-btn").on("click", function() {
            const currentStep = $(this).closest(".workflow-step");
            const prevStep = currentStep.prev(".workflow-step");
            if (prevStep.length) {
              currentStep.insertBefore(prevStep);
              updateStepNumbers();
            }
          });
          
          // Move down button
          $step.find(".move-step-down-btn").on("click", function() {
            const currentStep = $(this).closest(".workflow-step");
            const nextStep = currentStep.next(".workflow-step");
            if (nextStep.length) {
              currentStep.insertAfter(nextStep);
              updateStepNumbers();
            }
          });
          
          // Remove button
          $step.find(".remove-step-btn").on("click", function() {
            if (confirm("Are you sure you want to remove this step?")) {
              $(this).closest(".workflow-step").remove();
              updateStepNumbers();
            }
          });
        });
        
        $("#saveWorkflowBtn").text("Update Workflow");
      }
    };
  } else {
    $("#saveWorkflowBtn").text("Update Workflow");
  }
}

// Delete workflow
function deleteWorkflow(id) {
  if (confirm("Are you sure you want to delete this workflow?")) {
    const transaction = db.transaction("workflows", "readwrite");
    const store = transaction.objectStore("workflows");
    
    store.delete(id).onsuccess = function() {
      loadWorkflows();
      showNotification("Workflow deleted successfully!");
      
      if (editingWorkflowId === id) {
        resetWorkflowForm();
      }
      
      $("#workflowPreview").html('<p class="text-muted">Select a workflow to preview its steps and configuration.</p>');
    };
  }
}

// Run workflow handler
function runWorkflow(workflowId, mode) {
  // Get the workflow
  const transaction = db.transaction("workflows", "readonly");
  const store = transaction.objectStore("workflows");
  
  store.get(parseInt(workflowId)).onsuccess = function(e) {
    const workflow = e.target.result;
    
    if (!workflow) {
      showNotification("Workflow not found", "danger");
      return;
    }
    
    // Check if API key is available
    if (!openaiApiKey) {
      $("#workflowResultContainer").html(`
        <div class="alert alert-warning">
          <strong>API Key Missing!</strong> Please add your OpenAI API key in the Settings tab to use this feature.
        </div>
      `);
      return;
    }
    
    // Show loading state
    $("#workflowResultContainer").html('<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Setting up workflow execution...</div>');
    
    // Determine how to run the workflow based on mode
    if (mode === "interactive") {
      setupInteractiveWorkflow(workflow);
    } else {
      runEntireWorkflow(workflow);
    }
  };
}

// Set up interactive workflow execution
function setupInteractiveWorkflow(workflow) {
  const steps = workflow.steps || [];
  
  if (steps.length === 0) {
    $("#workflowResultContainer").html('<div class="alert alert-warning">This workflow has no steps defined.</div>');
    return;
  }
  
  // Create UI for interactive workflow
  let html = `
    <div class="interactive-workflow-container">
      <h5>Interactive Workflow: ${workflow.name}</h5>
      <div class="progress mb-3">
        <div class="progress-bar" role="progressbar" style="width: 0%" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
      </div>
      
      <div class="workflow-input-container mb-3">
        <h6>Initial Input</h6>
        <textarea class="form-control workflow-initial-input" rows="4" placeholder="Enter initial content for the workflow..."></textarea>
      </div>
      
      <div class="workflow-steps-container">
        <!-- Steps will be rendered here as the workflow progresses -->
      </div>
      
      <button class="btn btn-primary start-workflow-btn mt-3">
        <i class="fas fa-play"></i> Start Workflow
      </button>
    </div>
  `;
  
  $("#workflowResultContainer").html(html);
  
  // Handle start button click
  $(".start-workflow-btn").on("click", function() {
    const initialInput = $(".workflow-initial-input").val();
    
    if (!initialInput.trim()) {
      showNotification("Please provide initial input for the workflow", "warning");
      return;
    }
    
    // Begin the workflow execution
    executeWorkflowInteractively(workflow, initialInput);
    
    // Change button to reflect running state
    $(this).prop("disabled", true).html('<i class="fas fa-spinner fa-spin"></i> Running...');
  });
}

// Execute workflow interactively
function executeWorkflowInteractively(workflow, initialInput) {
  const steps = workflow.steps || [];
  let currentStepIndex = 0;
  let previousOutput = initialInput;
  
  // Function to execute the current step
  function executeStep() {
    if (currentStepIndex >= steps.length) {
      // Workflow is complete
      $(".progress-bar").css("width", "100%").attr("aria-valuenow", 100);
      showNotification("Workflow execution completed!", "success");
      return;
    }
    
    const step = steps[currentStepIndex];
    const progress = Math.round(((currentStepIndex + 1) / steps.length) * 100);
    
    // Update progress bar
    $(".progress-bar").css("width", progress + "%").attr("aria-valuenow", progress);
    
    // Get the action details
    const tx = db.transaction("actions", "readonly");
    const actionStore = tx.objectStore("actions");
    
    actionStore.get(parseInt(step.actionId)).onsuccess = function(e) {
      const action = e.target.result;
      
      if (!action) {
        appendStepError(currentStepIndex, "Action not found");
        currentStepIndex++;
        executeStep();
        return;
      }
      
      // Determine input for this step
      let stepInput;
      
      switch (step.inputSource) {
        case "original":
          stepInput = initialInput;
          break;
        case "custom":
          // Replace {previous} placeholders in custom input
          stepInput = step.customInput.replace(/{previous}/g, previousOutput);
          break;
        case "previous":
        default:
          stepInput = previousOutput;
          break;
      }
      
      // Render step UI
      appendStepUI(currentStepIndex, action, stepInput);
      
      // Process the input with the action
      const processedPrompt = action.prompt.replace(/{content}/g, stepInput || "");
      
      // Call the OpenAI API
      callOpenAiApi(processedPrompt, action, stepInput)
        .then(response => {
          // Update the step UI with the result
          updateStepWithResult(currentStepIndex, response);
          
          // Store the output for the next step
          previousOutput = response;
          
          // Move to the next step
          currentStepIndex++;
          
          // Execute the next step
          setTimeout(executeStep, 500);
        })
        .catch(error => {
          // Handle error
          appendStepError(currentStepIndex, error.message || "Failed to process this step");
          
          // Move to the next step
          currentStepIndex++;
          executeStep();
        });
    };
  }
  
  // Append step UI to the workflow container
  function appendStepUI(index, action, input) {
    const stepHtml = `
      <div class="workflow-step-container mb-3" id="workflow-step-${index}">
        <div class="card">
          <div class="card-header">
            Step ${index + 1}: ${action.title}
          </div>
          <div class="card-body">
            <h6>Input:</h6>
            <pre class="bg-light p-2 border rounded mb-3">${input}</pre>
            
            <h6>Processing...</h6>
            <div class="text-center">
              <i class="fas fa-spinner fa-spin"></i>
            </div>
          </div>
        </div>
      </div>
    `;
    
    $(".workflow-steps-container").append(stepHtml);
    
    // Scroll to the new step
    $('html, body').animate({
      scrollTop: $(`#workflow-step-${index}`).offset().top - 100
    }, 500);
  }
  
  // Update step UI with result
  function updateStepWithResult(index, result) {
    const stepContainer = $(`#workflow-step-${index} .card-body`);
    
    // Replace the loading indicator with the result
    stepContainer.find("h6:last").text("Output:");
    stepContainer.find(".text-center").replaceWith(`
      <div>
        <pre class="bg-light p-2 border rounded">${result}</pre>
        <div class="btn-group mt-2">
          <button class="btn btn-sm btn-outline-primary copy-step-result-btn" data-step="${index}">
            <i class="fas fa-copy"></i> Copy
          </button>
          <button class="btn btn-sm btn-outline-success save-step-result-btn" data-step="${index}" data-result="${encodeURIComponent(result)}">
            <i class="fas fa-save"></i> Save as Paragraph
          </button>
        </div>
      </div>
    `);
    
    // Set up copy button handler
    $(`#workflow-step-${index} .copy-step-result-btn`).on("click", function() {
      copyTextToClipboard(result);
    });
    
    // Set up save button handler
    $(`#workflow-step-${index} .save-step-result-btn`).on("click", function() {
      saveResultAsParagraph(result);
    });
  }
  
  // Append error to step UI
  function appendStepError(index, errorMessage) {
    const stepContainer = $(`#workflow-step-${index} .card-body`);
    
    // Replace the loading indicator with the error
    stepContainer.find("h6:last").text("Error:");
    stepContainer.find(".text-center").replaceWith(`
      <div class="alert alert-danger">
        ${errorMessage}
      </div>
    `);
  }
  
  // Start executing the workflow
  executeStep();
}

// Run the entire workflow without interactive steps
async function runEntireWorkflow(workflow) {
  const steps = workflow.steps || [];
  
  if (steps.length === 0) {
    $("#workflowResultContainer").html('<div class="alert alert-warning">This workflow has no steps defined.</div>');
    return;
  }
  
  // Show workflow execution UI
  $("#workflowResultContainer").html(`
    <div class="card mb-3">
      <div class="card-header">
        <h5 class="mb-0">Executing Workflow: ${workflow.name}</h5>
      </div>
      <div class="card-body">
        <div class="form-group">
          <label for="workflowInput">Input Content</label>
          <textarea id="workflowInput" class="form-control" rows="4" placeholder="Enter content to process..."></textarea>
        </div>
        <button id="startWorkflowBtn" class="btn btn-primary">Start Execution</button>
        
        <div class="progress mt-3" style="display:none;">
          <div class="progress-bar" role="progressbar" style="width: 0%"></div>
        </div>
        
        <div id="workflowStatus" class="mt-3"></div>
        <div id="workflowResults" class="mt-3"></div>
      </div>
    </div>
  `);
  
  // Handle start button click
  $("#startWorkflowBtn").on("click", async function() {
    const initialInput = $("#workflowInput").val().trim();
    
    if (!initialInput) {
      showNotification("Please provide input for the workflow", "warning");
      return;
    }
    
    // Disable the button and show progress
    $(this).prop("disabled", true).text("Running...");
    $(".progress").show();
    
    try {
      let currentInput = initialInput;
      let stepResults = [];
      
      // Process each step sequentially
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const progress = Math.round(((i + 1) / steps.length) * 100);
        
        // Update progress bar
        $(".progress-bar").css("width", progress + "%");
        
        // Update status
        $("#workflowStatus").html(`<div class="alert alert-info">Processing step ${i + 1} of ${steps.length}...</div>`);
        
        // Get the action for this step
        const action = await getActionById(step.actionId);
        
        if (!action) {
          stepResults.push({
            stepIndex: i,
            success: false,
            error: `Action with ID ${step.actionId} not found`
          });
          continue;
        }
        
        // Determine input for this step
        let stepInput;
        
        switch (step.inputSource) {
          case "original":
            stepInput = initialInput;
            break;
          case "custom":
            // Replace {previous} placeholders in custom input
            stepInput = step.customInput.replace(/{previous}/g, currentInput);
            break;
          case "previous":
          default:
            stepInput = currentInput;
            break;
        }
        
        // Process the step
        try {
          const processedPrompt = action.prompt.replace(/{content}/g, stepInput || "");
          const result = await callOpenAiApi(processedPrompt, action, stepInput);
          
          // Store the result
          stepResults.push({
            stepIndex: i,
            success: true,
            action: action.title,
            input: stepInput,
            output: result
          });
          
          // Update current input for the next step
          currentInput = result;
        } catch (error) {
          stepResults.push({
            stepIndex: i,
            success: false,
            action: action.title,
            error: error.message || "An error occurred"
          });
        }
      }
      
      // Show results
      renderWorkflowResults(stepResults);
      
      // Reset button
      $("#startWorkflowBtn").prop("disabled", false).text("Run Again");
      
    } catch (error) {
      $("#workflowStatus").html(`
        <div class="alert alert-danger">
          <strong>Error:</strong> ${error.message || "An unexpected error occurred"}
        </div>
      `);
      
      // Reset button
      $("#startWorkflowBtn").prop("disabled", false).text("Try Again");
    }
  });
}

// Get action by ID (returns a promise)
function getActionById(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("actions", "readonly");
    const store = transaction.objectStore("actions");
    
    const request = store.get(parseInt(id));
    
    request.onsuccess = function(e) {
      resolve(e.target.result);
    };
    
    request.onerror = function(e) {
      reject(e.target.error);
    };
  });
}

// Render workflow results
function renderWorkflowResults(results) {
  let html = `
    <h5 class="mt-4">Workflow Results</h5>
    <div class="accordion" id="workflowStepsAccordion">
  `;
  
  results.forEach((result, index) => {
    const stepSuccess = result.success;
    const stepTitle = `Step ${result.stepIndex + 1}${result.action ? ': ' + result.action : ''}`;
    
    html += `
      <div class="card">
        <div class="card-header" id="heading${index}">
          <h2 class="mb-0">
            <button class="btn btn-link btn-block text-left ${stepSuccess ? '' : 'text-danger'}" type="button" 
                    data-toggle="collapse" data-target="#collapse${index}" aria-expanded="${index === results.length - 1}" 
                    aria-controls="collapse${index}">
              ${stepTitle}
              ${stepSuccess ? 
                '<span class="badge badge-success float-right">Success</span>' : 
                '<span class="badge badge-danger float-right">Failed</span>'}
            </button>
          </h2>
        </div>
        
        <div id="collapse${index}" class="collapse ${index === results.length - 1 ? 'show' : ''}" 
             aria-labelledby="heading${index}" data-parent="#workflowStepsAccordion">
          <div class="card-body">
            ${stepSuccess ? 
              `<div class="mb-2">
                <h6>Input:</h6>
                <pre class="bg-light p-2 border rounded">${result.input}</pre>
              </div>
              <div>
                <h6>Output:</h6>
                <pre class="bg-light p-2 border rounded">${result.output}</pre>
                <div class="btn-group mt-2">
                  <button class="btn btn-sm btn-outline-primary copy-workflow-result-btn" data-result="${encodeURIComponent(result.output)}">
                    <i class="fas fa-copy"></i> Copy
                  </button>
                  <button class="btn btn-sm btn-outline-success save-workflow-result-btn" data-result="${encodeURIComponent(result.output)}">
                    <i class="fas fa-save"></i> Save as Paragraph
                  </button>
                </div>
              </div>` : 
              `<div class="alert alert-danger">
                <strong>Error:</strong> ${result.error}
              </div>`
            }
          </div>
        </div>
      </div>
    `;
  });
  
  html += `</div>`;
  
  $("#workflowResults").html(html);
  
  // Update status
  $("#workflowStatus").html(`
    <div class="alert ${allStepsSucceeded(results) ? 'alert-success' : 'alert-warning'}">
      <strong>Workflow completed</strong> with ${countSuccessfulSteps(results)} of ${results.length} steps successful.
    </div>
  `);
  
  // Set up event handlers for copy and save buttons
  $(".copy-workflow-result-btn").on("click", function() {
    const result = decodeURIComponent($(this).data("result"));
    copyTextToClipboard(result);
  });
  
  $(".save-workflow-result-btn").on("click", function() {
    const result = decodeURIComponent($(this).data("result"));
    saveResultAsParagraph(result);
  });
}

// Check if all steps succeeded
function allStepsSucceeded(results) {
  return results.every(result => result.success);
}

// Count successful steps
function countSuccessfulSteps(results) {
  return results.filter(result => result.success).length;
}
