// Workflow Management Functions

let editingWorkflowId = null;
let currentEditingStepIndex = null;
let workflowStepSelectedContent = {};

// Declare the function as a variable to hoist it before loadWorkflows()
const editWorkflow = function(workflow) {
  editingWorkflowId = workflow.id;
  $("#workflowName").val(workflow.name);
  $("#workflowDesc").val(workflow.description || "");
  
  // Clear existing steps
  $("#workflowSteps").empty();
  
  // Reset the selected content storage
  workflowStepSelectedContent = {};
  
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
          
          // Store selected content if it exists
          if (step.selectedContent) {
            workflowStepSelectedContent[index] = step.selectedContent;
          }
          
          // Convert legacy format if needed
          const inputSources = step.inputSources || (step.inputSource ? [step.inputSource] : []);
          
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
                  <div class="col-md-12">
                    <div class="form-group">
                      <label>Action</label>
                      <select class="form-control step-action-id" required>
                        <option value="">Select an action...</option>
                        ${actionOptions}
                      </select>
                    </div>
                  </div>
                </div>
                
                <div class="form-group">
                  <label>Input Sources</label>
                  <div class="input-source-checks">
                    ${inputSources.map(source => `
                      <div class="form-check">
                        <input class="form-check-input step-input-${source}" type="checkbox" id="input${source}-${index}" value="${source}" ${source === 'custom' ? 'checked' : ''}>
                        <label class="form-check-label" for="input${source}-${index}">
                          ${source.charAt(0).toUpperCase() + source.slice(1)} input
                        </label>
                      </div>
                    `).join('')}
                  </div>
                </div>
                
                <div class="form-group custom-input-container" style="display:${inputSources.includes('custom') ? 'block' : 'none'};">
                  <label>Custom Input</label>
                  <textarea class="form-control step-custom-input" rows="3" placeholder="Enter custom input for this step">${step.customInput || ''}</textarea>
                  <small class="form-text text-muted">Use {previous} to insert the output from the previous step</small>
                </div>

                <div class="mt-2">
                  <button class="btn btn-sm btn-secondary selectStepContentBtn" type="button" data-step-index="${index}">
                    Select Content
                  </button>
                  <span class="selected-content-indicator" style="display:${workflowStepSelectedContent[index] ? 'inline' : 'none'};">
                    <i class="fas fa-check-circle text-success"></i> <span class="selected-count">${workflowStepSelectedContent[index] ? workflowStepSelectedContent[index].length : 0}</span> items selected
                  </span>
                </div>
              </div>
            </div>
          `;
          
          // Add the step to the form
          $("#workflowSteps").append(stepHtml);
          
          // Set up event handlers for this step
          const $step = $("#workflowSteps .workflow-step").last();
          
          $step.find(".step-input-custom").on("change", function() {
            const customInputContainer = $(this).closest(".workflow-step").find(".custom-input-container");
            if ($(this).prop('checked')) {
              customInputContainer.slideDown();
            } else {
              customInputContainer.slideUp();
            }
          });
          
          $step.find(".move-step-up-btn").on("click", function() {
            const currentStep = $(this).closest(".workflow-step");
            const prevStep = currentStep.prev(".workflow-step");
            if (prevStep.length) {
              currentStep.insertBefore(prevStep);
              updateStepNumbers();
            }
          });
          
          $step.find(".move-step-down-btn").on("click", function() {
            const currentStep = $(this).closest(".workflow-step");
            const nextStep = currentStep.next(".workflow-step");
            if (nextStep.length) {
              currentStep.insertAfter(nextStep);
              updateStepNumbers();
            }
          });
          
          $step.find(".remove-step-btn").on("click", function() {
            if (confirm("Are you sure you want to remove this step?")) {
              $(this).closest(".workflow-step").remove();
              updateStepNumbers();
              
              if ($("#workflowSteps .workflow-step").length === 0) {
                $("#workflowSteps").append('<p class="text-muted text-center my-3" id="emptyStepsMessage">No steps added yet. Click "Add Step" to begin.</p>');
              }
            }
          });

          $step.find(".selectStepContentBtn").on("click", function() {
            openContentSelectionForStep($(this).data("step-index"));
          });

          $step.find(".step-input-selected").on("change", function() {
            if ($(this).is(":checked") && !workflowStepSelectedContent[index]) {
              openContentSelectionForStep(index);
            }
          });
        });
        
        $("#saveWorkflowBtn").text("Update Workflow");
      }
    };
  } else {
    $("#saveWorkflowBtn").text("Update Workflow");
  }
};

// Similar approach for deleteWorkflow
const deleteWorkflow = function(id) {
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
};

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

$(document).ready(function() {
  console.log("Document ready, initializing workflow bindings");
  initWorkflowBindings();
  
  $('a[data-toggle="tab"][href="#workflowsView"]').on('shown.bs.tab', function (e) {
    console.log("Workflows tab shown");
    loadWorkflows();
  });

  $("#confirmContentSelection").off("click.workflow").on("click.workflow", function() {
    if (currentEditingStepIndex !== null) {
      console.log(`Content selected for step ${currentEditingStepIndex}, items:`, selectedContentItems);
      
      workflowStepSelectedContent[currentEditingStepIndex] = [...selectedContentItems];
      
      const $step = $(`.workflow-step[data-step-index="${currentEditingStepIndex}"]`);
      const itemCount = selectedContentItems.length;
      
      $step.find(".selectStepContentBtn")
        .addClass("btn-success")
        .removeClass("btn-secondary")
        .text("Update Content");
      
      $step.find(".selected-content-indicator").show()
        .find(".selected-count").text(itemCount);
      
      $step.find(".step-input-selected").prop("checked", true);
      
      $("#contentSelectionModal").modal("hide");
    }
  });
  
  $("#contentSelectionModal").on("hidden.bs.modal", function() {
    currentEditingStepIndex = null;
  });

  $("#searchBlocksSelectionBtn").off("click").on("click", function() {
    const searchTerm = $("#blockSelectionSearch").val().trim();
    loadBlocksForSelection(searchTerm);
  });
  
  $("#searchDocsSelectionBtn").off("click").on("click", function() {
    const searchTerm = $("#docSelectionSearch").val().trim();
    loadDocumentsForSelection(searchTerm);
  });
  
  $("#blockSelectionSearch").off("keypress").on("keypress", function(e) {
    if (e.which === 13) {
      $("#searchBlocksSelectionBtn").click();
    }
  });
  
  $("#docSelectionSearch").off("keypress").on("keypress", function(e) {
    if (e.which === 13) {
      $("#searchDocsSelectionBtn").click();
    }
  });

  // Modal initialization check
  $('#contentSelectionModal').on('shown.bs.modal', function() {
    console.log("Modal shown event triggered - modal is now visible");
  });
  
  $('#contentSelectionModal').on('show.bs.modal', function() {
    console.log("Modal show event triggered - modal is about to be shown");
  });
  
  $('#contentSelectionModal').on('hidden.bs.modal', function() {
    console.log("Modal hidden event triggered - modal is now hidden");
    currentEditingStepIndex = null;
  });
});

// Load saved workflows
function loadWorkflows(searchTerm = "") {
  $("#workflowList").empty();
  
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
  
  $("#debug-info").show().html('<div class="alert alert-info">Loading actions...</div>');
  
  $("#emptyStepsMessage").remove();
  
  $("#workflowSteps").append('<div class="text-center py-2" id="loading-actions"><i class="fas fa-spinner fa-spin"></i> Loading actions...</div>');
  
  try {
    if (!window.db) {
      throw new Error("Database not initialized");
    }
    
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
  
    getActionsPromise.then(actions => {
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
              <div class="col-md-12">
                <div class="form-group">
                  <label>Action</label>
                  <select class="form-control step-action-id" required>
                    <option value="">Select an action...</option>
                    ${actionOptions}
                  </select>
                </div>
              </div>
            </div>
            
            <div class="form-group">
              <label>Input Sources</label>
              <div class="input-source-checks">
                <div class="form-check">
                  <input class="form-check-input step-input-previous" type="checkbox" id="inputPrevious-${stepIndex}" value="previous">
                  <label class="form-check-label" for="inputPrevious-${stepIndex}">
                    Output from previous step
                  </label>
                </div>
                <div class="form-check">
                  <input class="form-check-input step-input-original" type="checkbox" id="inputOriginal-${stepIndex}" value="original">
                  <label class="form-check-label" for="inputOriginal-${stepIndex}">
                    Original input
                  </label>
                </div>
                <div class="form-check">
                  <input class="form-check-input step-input-custom" type="checkbox" id="inputCustom-${stepIndex}" value="custom">
                  <label class="form-check-label" for="inputCustom-${stepIndex}">
                    Custom input
                  </label>
                </div>
                <div class="form-check">
                  <input class="form-check-input step-input-selected" type="checkbox" id="inputSelected-${stepIndex}" value="selected">
                  <label class="form-check-label" for="inputSelected-${stepIndex}">
                    Selected content
                  </label>
                </div>
              </div>
            </div>
            
            <div class="form-group custom-input-container" style="display:none;">
              <label>Custom Input</label>
              <textarea class="form-control step-custom-input" rows="3" placeholder="Enter custom input for this step"></textarea>
              <small class="form-text text-muted">Use {previous} to insert the output from the previous step</small>
            </div>

            <div class="mt-2">
              <button class="btn btn-sm btn-secondary selectStepContentBtn" type="button" data-step-index="${stepIndex}">
                Select Content
              </button>
              <span class="selected-content-indicator" style="display:none;">
                <i class="fas fa-check-circle text-success"></i> <span class="selected-count"></span> items selected
              </span>
            </div>
          </div>
        </div>
      `;
      
      $("#workflowSteps").append(stepHtml);
      
      const $newStep = $("#workflowSteps .workflow-step").last();
      
      $newStep.find(".step-input-custom").on("change", function() {
        const customInputContainer = $(this).closest(".workflow-step").find(".custom-input-container");
        if ($(this).prop('checked')) {
          customInputContainer.slideDown();
        } else {
          customInputContainer.slideUp();
        }
      });
      
      $newStep.find(".move-step-up-btn").on("click", function() {
        const currentStep = $(this).closest(".workflow-step");
        const prevStep = currentStep.prev(".workflow-step");
        if (prevStep.length) {
          currentStep.insertBefore(prevStep);
          updateStepNumbers();
        }
      });
      
      $newStep.find(".move-step-down-btn").on("click", function() {
        const currentStep = $(this).closest(".workflow-step");
        const nextStep = currentStep.next(".workflow-step");
        if (nextStep.length) {
          currentStep.insertAfter(nextStep);
          updateStepNumbers();
        }
      });
      
      $newStep.find(".remove-step-btn").on("click", function() {
        if (confirm("Are you sure you want to remove this step?")) {
          $(this).closest(".workflow-step").remove();
          updateStepNumbers();
          
          if ($("#workflowSteps .workflow-step").length === 0) {
            $("#workflowSteps").append('<p class="text-muted text-center my-3" id="emptyStepsMessage">No steps added yet. Click "Add Step" to begin.</p>');
          }
        }
      });

      $newStep.find(".selectStepContentBtn").on("click", function() {
        openContentSelectionForStep($(this).data("step-index"));
      });

      $newStep.find(".step-input-selected").on("change", function() {
        if ($(this).is(":checked") && !workflowStepSelectedContent[stepIndex]) {
          openContentSelectionForStep(stepIndex);
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

// Function to open content selection modal
function openContentSelectionForStep(stepIndex) {
  currentEditingStepIndex = stepIndex;
  console.log("Opening content selection for step", stepIndex);
  
  if (typeof window.selectedContentItems === 'undefined') {
    window.selectedContentItems = [];
  }
  
  // Reset selectedContentItems and populate with any existing selections
  if (workflowStepSelectedContent[stepIndex]) {
    selectedContentItems = [...workflowStepSelectedContent[stepIndex]];
  } else {
    selectedContentItems = [];
  }
  
  // Debugging code to check modal visibility issues
  console.log("Content selection modal element exists:", $("#contentSelectionModal").length > 0);
  
  // Create updateSelectedItemsUI function if it doesn't exist
  if (typeof updateSelectedItemsUI !== 'function') {
    window.updateSelectedItemsUI = function() {
      const selectedItemsList = $("#selectedItemsList");
      const selectedItemsCount = $("#selectedItemsCount");
      
      selectedItemsCount.text(selectedContentItems.length);
      
      if (selectedContentItems.length === 0) {
        selectedItemsList.html('<p class="text-muted text-center mb-0">No items selected</p>');
      } else {
        let itemsHtml = '';
        
        selectedContentItems.forEach((item, index) => {
          itemsHtml += `
            <div class="selected-item mb-1 d-flex justify-content-between align-items-center">
              <span>${item.title} <small class="text-muted">(${item.type})</small></span>
              <button type="button" class="btn btn-sm btn-outline-danger remove-selected-item" data-index="${index}">
                <i class="fas fa-times"></i>
              </button>
            </div>
          `;
        });
        
        selectedItemsList.html(itemsHtml);
        
        $(".remove-selected-item").on("click", function() {
          const index = $(this).data("index");
          
          if (index >= 0 && index < selectedContentItems.length) {
            const itemToRemove = selectedContentItems[index];
            
            if (itemToRemove.type === "block") {
              $(`#block-${itemToRemove.id}, #block_${itemToRemove.id}, #ref-block-${itemToRemove.id}, #tag-block-${itemToRemove.id}`).prop("checked", false);
            } else if (itemToRemove.type === "paragraph") {
              $(`#para-${itemToRemove.docId}-${itemToRemove.paraIndex}, #tag-para-${itemToRemove.docId}-${itemToRemove.paraIndex}`).prop("checked", false);
            }
            
            selectedContentItems.splice(index, 1);
            updateSelectedItemsUI();
          }
        });
      }
    };
  }
  
  updateSelectedItemsUI();
  
  // Setup modal content before showing
  $(".action-selection-info").text("Select content for this workflow step");
  $("#contentSelectionModal").data("selection-mode", "multiple");
  
  // Initialize the tab contents before showing modal (important for proper display)
  $("#blocksTab").addClass("show active");
  $("#documentsTab, #tagsTab, #referencesTab").removeClass("show active");
  
  // Show the modal
  try {
    // Remove any existing modals and backdrop
    $(".modal-backdrop").remove();
    
    // Show modal with proper settings
    $("#contentSelectionModal").modal({
      backdrop: 'static',
      keyboard: true,
      show: true
    });
    
    console.log("Modal shown with jQuery modal()");
  } catch(error) {
    console.error("Error showing modal:", error);
    alert("Error showing content selection modal. Please see console for details.");
  }
  
  // Load content for selection tabs
  loadBlocksForSelection();
  loadDocumentsForSelection();
  
  if (typeof loadTagsForSelection === 'function') {
    loadTagsForSelection();
  }
  if (typeof loadReferencesForSelection === 'function') {
    loadReferencesForSelection();
  }
}

// Preview a workflow when clicked in the list
function previewWorkflow(workflow) {
  // Mark as selected for actions
  selectedWorkflowId = workflow.id;
  
  // Create HTML for the workflow preview
  let html = `
    <h5>${workflow.name}</h5>
    <p>${workflow.description || "<em>No description</em>"}</p>
    
    <div class="mt-3">
      <strong>Steps:</strong>
      <ol class="workflow-steps-list">
  `;
  
  if (workflow.steps && workflow.steps.length > 0) {
    // Get promises to fetch all action details
    const promises = workflow.steps.map(step => {
      return new Promise((resolve) => {
        const tx = db.transaction("actions", "readonly");
        const store = tx.objectStore("actions");
        store.get(step.actionId).onsuccess = (e) => {
          const action = e.target.result;
          resolve({
            step: step,
            action: action || { title: `Unknown Action (ID: ${step.actionId})` }
          });
        };
      });
    });
    
    // Wait for all action details to be fetched
    Promise.all(promises).then(results => {
      results.forEach(result => {
        const step = result.step;
        const action = result.action;
        
        let inputSourcesText = '';
        if (step.inputSources && step.inputSources.length > 0) {
          inputSourcesText = step.inputSources.map(src => 
            `<span class="badge badge-info mr-1">${src}</span>`
          ).join(' ');
        }
        
        let selectedContentText = '';
        if (step.selectedContent && step.selectedContent.length > 0) {
          selectedContentText = `<span class="badge badge-success">${step.selectedContent.length} items selected</span>`;
        }
        
        html += `
          <li class="mb-2">
            <div class="card">
              <div class="card-body py-2">
                <strong>${action.title}</strong>
                <div class="text-muted small">
                  <strong>Inputs:</strong> ${inputSourcesText || '<em>None</em>'}
                </div>
                <div class="mt-1">
                  ${selectedContentText}
                  ${step.customInput ? '<span class="badge badge-secondary">Custom input provided</span>' : ''}
                </div>
              </div>
            </div>
          </li>
        `;
      });
      
      html += `
          </ol>
        </div>
        <div class="mt-3 d-flex justify-content-end">
          <button class="btn btn-primary run-workflow-btn" data-workflow-id="${workflow.id}">
            <i class="fas fa-play"></i> Run Workflow
          </button>
        </div>
      `;
      
      $("#workflowPreview").html(html);
      
      // Add event listener for the run button
      $(".run-workflow-btn").click(function() {
        const workflowId = $(this).data("workflow-id");
        runWorkflow(workflowId);
      });
    });
  } else {
    html += `
          <li><em>This workflow has no steps.</em></li>
        </ol>
      </div>
    `;
    
    $("#workflowPreview").html(html);
  }
}

// Update step numbers when reordering steps
function updateStepNumbers() {
  $(".workflow-step").each(function(index) {
    $(this).data("step-index", index);
    $(this).find("h6").text(`Step ${index + 1}`);
    $(this).attr("data-step-index", index);
  });
}

// Reset workflow form
function resetWorkflowForm() {
  editingWorkflowId = null;
  $("#workflowForm")[0].reset();
  $("#workflowSteps").empty();
  $("#workflowSteps").append('<p class="text-muted text-center my-3" id="emptyStepsMessage">No steps added yet. Click "Add Step" to begin.</p>');
  $("#saveWorkflowBtn").text("Save Workflow");
  workflowStepSelectedContent = {};
}

// Function to run a workflow
function runWorkflow(workflowId) {
  $("#workflowResultContainer").html('<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Running workflow...</div>');
  
  const tx = db.transaction("workflows", "readonly");
  const store = tx.objectStore("workflows");
  
  store.get(parseInt(workflowId)).onsuccess = async function(e) {
    const workflow = e.target.result;
    
    if (!workflow) {
      $("#workflowResultContainer").html('<div class="alert alert-danger">Workflow not found</div>');
      return;
    }
    
    // Check if workflow has steps
    if (!workflow.steps || workflow.steps.length === 0) {
      $("#workflowResultContainer").html('<div class="alert alert-warning">This workflow has no steps to execute</div>');
      return;
    }
    
    // Check for API key
    const openaiApiKey = localStorage.getItem('openai_api_key');
    if (!openaiApiKey) {
      $("#workflowResultContainer").html(`
        <div class="alert alert-warning">
          <strong>API Key Missing!</strong> Please add your OpenAI API key in the Settings tab to use this feature.
        </div>
      `);
      return;
    }

    try {
      // Create a results display area
      const resultsDiv = $(`
        <div class="workflow-results">
          <h5>Workflow Results</h5>
          <div class="workflow-steps-results"></div>
        </div>
      `);
      
      $("#workflowResultContainer").html('');
      $("#workflowResultContainer").append(resultsDiv);
      
      // Variables to track state through steps
      let originalInput = "";
      let previousOutput = "";
      
      // Execute each step sequentially
      for (let stepIndex = 0; stepIndex < workflow.steps.length; stepIndex++) {
        const step = workflow.steps[stepIndex];
        const stepResultDiv = $(`
          <div class="card mb-3 workflow-step-result">
            <div class="card-header d-flex justify-content-between align-items-center">
              <span>Step ${stepIndex + 1}</span>
              <div class="spinner-border spinner-border-sm text-primary" role="status">
                <span class="sr-only">Loading...</span>
              </div>
            </div>
            <div class="card-body">
              <div class="step-status">Running...</div>
              <div class="step-output" style="display:none;"></div>
            </div>
          </div>
        `);
        
        // Add the step result to the display
        $(".workflow-steps-results").append(stepResultDiv);
        
        try {
          // Get the action for this step
          const action = await getActionById(step.actionId);
          
          if (!action) {
            throw new Error(`Action (ID: ${step.actionId}) not found`);
          }
          
          // Update step status to show which action is running
          stepResultDiv.find(".step-status").html(`
            <div class="d-flex align-items-center">
              <div class="mr-2">Running action: <strong>${action.title}</strong></div>
            </div>
          `);
          
          // Assemble the input for this step based on its input sources
          let stepInput = "";
          
          // If this is the first step, original input is what the user types
          if (stepIndex === 0) {
            originalInput = $("#workflowTestInput").val() || "";
          }
          
          if (step.inputSources) {
            // Process each input source
            for (const source of step.inputSources) {
              switch (source) {
                case "previous":
                  if (previousOutput) {
                    stepInput += (stepInput ? "\n\n---\n\n" : "") + previousOutput;
                  }
                  break;
                  
                case "original":
                  if (originalInput) {
                    stepInput += (stepInput ? "\n\n---\n\n" : "") + originalInput;
                  }
                  break;
                  
                case "custom":
                  if (step.customInput) {
                    // Replace {previous} placeholder with actual previous output
                    let customInput = step.customInput.replace(/{previous}/g, previousOutput);
                    stepInput += (stepInput ? "\n\n---\n\n" : "") + customInput;
                  }
                  break;
                  
                case "selected":
                  if (step.selectedContent && step.selectedContent.length) {
                    // Process selected content similar to actions.js
                    const contentText = await assembleContentFromSelectedItems(step.selectedContent);
                    if (contentText) {
                      stepInput += (stepInput ? "\n\n---\n\n" : "") + contentText;
                    }
                  }
                  break;
              }
            }
          }
          
          // If no input was assembled, use an empty string
          if (!stepInput) {
            stepInput = "";
          }
          
          // Replace the content placeholder in the prompt
          const processedPrompt = action.prompt.replace(/{content}/g, stepInput);
          
          // Call the OpenAI API
          const stepOutput = await callOpenAiApi(processedPrompt, action, stepInput);
          
          // Update the previous output for the next step
          previousOutput = stepOutput;
          
          // Update the step result in the display
          stepResultDiv.find(".spinner-border").remove();
          stepResultDiv.find(".card-header").append(`
            <span class="badge badge-success">Completed</span>
          `);
          
          stepResultDiv.find(".step-status").html(`
            <div>
              <strong>${action.title}</strong> completed successfully
              <button class="btn btn-sm btn-outline-secondary toggle-output-btn mt-2">
                Show Output
              </button>
            </div>
          `);
          
          stepResultDiv.find(".step-output").html(`
            <div class="mt-3">
              <div class="card bg-light">
                <div class="card-header d-flex justify-content-between">
                  <span>Output</span>
                  <button class="btn btn-sm btn-outline-primary copy-output-btn">
                    <i class="fas fa-copy"></i> Copy
                  </button>
                </div>
                <div class="card-body">
                  <pre class="mb-0">${stepOutput}</pre>
                </div>
              </div>
            </div>
          `);
          
          // Add event handlers for the buttons
          stepResultDiv.find(".toggle-output-btn").on("click", function() {
            const outputDiv = stepResultDiv.find(".step-output");
            const $btn = $(this);
            
            if (outputDiv.is(":visible")) {
              outputDiv.slideUp();
              $btn.text("Show Output");
            } else {
              outputDiv.slideDown();
              $btn.text("Hide Output");
            }
          });
          
          stepResultDiv.find(".copy-output-btn").on("click", function() {
            copyTextToClipboard(stepOutput);
          });
          
        } catch (stepError) {
          // Update the step result to show the error
          stepResultDiv.find(".spinner-border").remove();
          stepResultDiv.find(".card-header").append(`
            <span class="badge badge-danger">Failed</span>
          `);
          
          stepResultDiv.find(".step-status").html(`
            <div class="alert alert-danger">
              Error: ${stepError.message || stepError}
            </div>
          `);
          
          // Stop the workflow execution on error
          throw new Error(`Step ${stepIndex + 1} failed: ${stepError.message || stepError}`);
        }
      }
      
      // Add a final success message
      $("#workflowResultContainer").append(`
        <div class="alert alert-success mt-3">
          <i class="fas fa-check-circle"></i> Workflow "${workflow.name}" completed successfully!
        </div>
      `);
      
      // Add a button to save the final result
      $("#workflowResultContainer").append(`
        <div class="mt-3">
          <button class="btn btn-success save-workflow-result">
            <i class="fas fa-save"></i> Save Final Result as Paragraph
          </button>
        </div>
      `);
      
      // Add event handler for saving the final result
      $(".save-workflow-result").on("click", function() {
        if (previousOutput) {
          saveResultAsParagraph(previousOutput);
        }
      });
      
    } catch (error) {
      // Add overall error message if the workflow fails
      $("#workflowResultContainer").append(`
        <div class="alert alert-danger mt-3">
          <i class="fas fa-exclamation-triangle"></i> Workflow execution stopped: ${error.message || error}
        </div>
      `);
    }
  };
}

// Helper function to get an action by its ID
function getActionById(actionId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("actions", "readonly");
    const store = tx.objectStore("actions");
    
    store.get(parseInt(actionId)).onsuccess = function(e) {
      resolve(e.target.result);
    };
    
    store.get(parseInt(actionId)).onerror = function(e) {
      reject(e.target.error);
    };
  });
}

// Assemble content from selected items (for workflow steps)
async function assembleContentFromSelectedItems(selectedItems) {
  if (!selectedItems || !selectedItems.length) return "";
  
  let contentParts = [];
  const blockFetchPromises = [];
  const paragraphFetchPromises = [];
  
  // Process blocks
  for (const item of selectedItems) {
    if (item.type === "block") {
      blockFetchPromises.push(
        new Promise((resolve, reject) => {
          const transaction = db.transaction("blocks", "readonly");
          const store = transaction.objectStore("blocks");
          
          store.get(parseInt(item.id)).onsuccess = function(e) {
            const block = e.target.result;
            if (block) {
              resolve({
                id: block.id,
                title: block.title || `Block ${block.id}`,
                text: block.text || "",
                tags: block.tags,
                standard: block.standard,
                stdLevels: block.stdLevels
              });
            } else {
              resolve({
                id: item.id,
                title: `Unknown Block ${item.id}`,
                text: `Block with ID ${item.id} not found`,
                error: true
              });
            }
          };
        })
      );
    } else if (item.type === "paragraph") {
      paragraphFetchPromises.push(
        new Promise((resolve, reject) => {
          const transaction = db.transaction("documents", "readonly");
          const store = transaction.objectStore("documents");
          
          store.get(parseInt(item.docId)).onsuccess = function(e) {
            const doc = e.target.result;
            if (doc && doc.paragraphs && doc.paragraphs[item.paraIndex]) {
              const para = doc.paragraphs[item.paraIndex];
              
              // Fetch referenced blocks if any
              const refBlockPromises = [];
              if (para.blockRefs && para.blockRefs.length > 0) {
                para.blockRefs.forEach(blockId => {
                  refBlockPromises.push(
                    new Promise((resolveBlock) => {
                      const blockTx = db.transaction("blocks", "readonly");
                      const blockStore = blockTx.objectStore("blocks");
                      blockStore.get(parseInt(blockId)).onsuccess = function(e) {
                        const block = e.target.result;
                        if (block) {
                          resolveBlock({
                            id: block.id,
                            title: block.title || `Block ${block.id}`,
                            text: block.content
                          });
                        } else {
                          resolveBlock({
                            id: blockId,
                            title: `Unknown Block ${blockId}`,
                            text: `Block with ID ${blockId} not found`,
                            error: true
                          });
                        }
                      };
                    })
                  );
                });
              }
              
              Promise.all(refBlockPromises).then(refBlocks => {
                resolve({
                  id: `${doc.id}-${item.paraIndex}`,
                  docTitle: doc.title,
                  paragraphNumber: item.paraIndex + 1,
                  text: para.content,
                  tags: para.tags,
                  refBlocks: refBlocks
                });
              });
            } else {
              resolve({
                id: item.id,
                text: `Paragraph not found`,
                error: true
              });
            }
          };
        })
      );
    }
  }
  
  // Wait for all blocks to be fetched
  const blocks = await Promise.all(blockFetchPromises);
  for (const block of blocks) {
    contentParts.push(`# Block: ${block.title}\n\n${block.text || ""}`);
  }
  
  // Wait for all paragraphs and their referenced blocks
  const paragraphs = await Promise.all(paragraphFetchPromises);
  for (const para of paragraphs) {
    if (para.error) {
      contentParts.push(`# Error fetching paragraph\n\n${para.text || "Unknown error"}`);
      continue;
    }
    
    contentParts.push(`# Paragraph ${para.paragraphNumber} from "${para.docTitle}"\n\n${para.text || ""}`);
    
    // Add referenced blocks for this paragraph
    if (para.refBlocks && para.refBlocks.length) {
      for (const refBlock of para.refBlocks) {
        contentParts.push(`## Referenced Block: ${refBlock.title}\n\n${refBlock.text}`);
      }
    }
  }
  
  return contentParts.join("\n\n---\n\n");
}

// This function already exists in your actions.js, adding as a copy here
// to make workflow.js independent if needed
function copyTextToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  
  showNotification("Text copied to clipboard!");
}

// Save result as a paragraph in the document form (copy from actions.js)
function saveResultAsParagraph(text) {
  // Switch to Documents tab
  $('#viewTabs a[href="#documentsView"]').tab('show');
  
  // Add a new paragraph if there's not already one
  if ($("#paragraphContainer").children().length === 0) {
    addParagraph();
  } else {
    // Otherwise, add a new paragraph at the end
    addParagraph();
  }
  
  // Get the last paragraph added and set its content
  const lastParagraph = $("#paragraphContainer .paragraph-block").last();
  lastParagraph.find(".docParagraph").val(text);
  
  // Show notification
  showNotification("Results added as a new paragraph!", "success");
}

function handleWorkflowFormSubmit() {
  const name = $("#workflowName").val().trim();
  const description = $("#workflowDesc").val().trim();
  
  const steps = [];
  $("#workflowSteps .workflow-step").each(function() {
    const stepIndex = parseInt($(this).data("step-index"));
    const actionId = $(this).find(".step-action-id").val();
    
    const inputSources = [];
    if ($(this).find(".step-input-previous").prop('checked')) {
      inputSources.push("previous");
    }
    if ($(this).find(".step-input-original").prop('checked')) {
      inputSources.push("original");
    }
    if ($(this).find(".step-input-custom").prop('checked')) {
      inputSources.push("custom");
    }
    if ($(this).find(".step-input-selected").prop('checked')) {
      inputSources.push("selected");
    }
    
    const customInput = $(this).find(".step-custom-input").val();
    
    if (actionId) {
      const stepData = {
        actionId: parseInt(actionId),
        inputSources: inputSources,
        customInput: inputSources.includes("custom") ? customInput : ""
      };
      
      if (inputSources.includes("selected") && workflowStepSelectedContent[stepIndex]) {
        stepData.selectedContent = workflowStepSelectedContent[stepIndex];
      }
      
      steps.push(stepData);
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
