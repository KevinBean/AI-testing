/**
 * User Interface for Advanced Calculations System
 * Handles UI interactions, form management, and rendering
 */

// Create a namespace for the UI
window.calculationsUI = (function() {
  // Private state
  let _currentCalculation = null;
  let _currentFunction = null;
  let _codeEditors = {};
  let _settings = {};
  let _aiProcessingQueue = [];
  
  /**
   * Initialize the UI
   */
  function init() {
    // Initialize the database
    window.calculationsDB.init()
      .then(() => {
        // Initialize the calculation engine
        return window.calculationsEngine.init();
      })
      .then(() => {
        // Load settings
        return window.calculationsDB.settings.get("generalSettings");
      })
      .then(settings => {
        _settings = settings || {};
        
        // Initialize UI components
        initializeUIComponents();
        initializeEventListeners();
        loadCalculations();
        loadFunctions();
        
        // Check for Brython support
        return window.calculationsDB.settings.get("brythonSettings");
      })
      .then(brythonSettings => {
        if (brythonSettings && brythonSettings.enabled) {
          initializeBrython(brythonSettings);
        }
        
        // Show notification
        showNotification("System initialized successfully", "success");
      })
      .catch(error => {
        console.error("Initialization error:", error);
        showNotification("Error initializing system: " + error.message, "danger");
      });
  }
  
  /**
   * Initialize UI components
   */
  function initializeUIComponents() {
    // Initialize code editors
    initializeCodeEditors();
    
    // Apply settings to UI elements
    applySettings();
    
    // Initialize tabs
    $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
      // Resize code editors when tab is shown
      Object.values(_codeEditors).forEach(editor => {
        editor.refresh();
      });
    });
    
    // Initialize tooltips
    $('[data-toggle="tooltip"]').tooltip();
    
    // Initialize parameter sortable containers
    $("#parametersContainer").sortable({
      placeholder: "sortable-placeholder",
      handle: ".draggable-handle",
      update: function() {
        // Update parameter order
        if (_currentCalculation && _currentCalculation.parameters) {
          const newOrder = [];
          $("#parametersContainer .parameter-item").each(function() {
            const paramName = $(this).data("param-name");
            const param = _currentCalculation.parameters.find(p => p.name === paramName);
            if (param) {
              newOrder.push(param);
            }
          });
          _currentCalculation.parameters = newOrder;
        }
      }
    });
  }
  
  /**
   * Initialize code editors
   */
  function initializeCodeEditors() {
    // Custom JS code editor
    _codeEditors.customJS = CodeMirror(document.getElementById("customJsEditor"), {
      mode: "javascript",
      theme: "eclipse",
      lineNumbers: true,
      indentUnit: 2,
      smartIndent: true,
      tabSize: 2,
      indentWithTabs: false,
      extraKeys: {
        "Ctrl-Space": "autocomplete"
      }
    });
    
    // Function code editor
    _codeEditors.function = CodeMirror(document.getElementById("functionCodeEditor"), {
      mode: "javascript",
      theme: "eclipse",
      lineNumbers: true,
      indentUnit: 2,
      smartIndent: true,
      tabSize: 2,
      indentWithTabs: false,
      extraKeys: {
        "Ctrl-Space": "autocomplete"
      }
    });
    
    // Python code editor (if Brython is enabled)
    if (document.getElementById("customPyEditor")) {
      _codeEditors.customPython = CodeMirror(document.getElementById("customPyEditor"), {
        mode: "python",
        theme: "eclipse",
        lineNumbers: true,
        indentUnit: 4,
        smartIndent: true,
        tabSize: 4,
        indentWithTabs: false,
        extraKeys: {
          "Ctrl-Space": "autocomplete"
        }
      });
    }
  }
  
  /**
   * Initialize Brython if enabled
   * @param {Object} settings - Brython settings
   */
  function initializeBrython(settings) {
    // Check if Brython is already loaded
    if (typeof brython !== 'function') {
      // Load Brython scripts
      const brythonScript = document.createElement('script');
      brythonScript.src = "https://cdnjs.cloudflare.com/ajax/libs/brython/3.11.0/brython.min.js";
      document.head.appendChild(brythonScript);
      
      const brythonStdlibScript = document.createElement('script');
      brythonStdlibScript.src = "https://cdnjs.cloudflare.com/ajax/libs/brython/3.11.0/brython_stdlib.min.js";
      document.head.appendChild(brythonStdlibScript);
      
      // Initialize Brython when scripts are loaded
      brythonScript.onload = function() {
        if (typeof brython === 'function') {
          document.body.setAttribute('onload', 'brython()');
          brython();
          console.log("Brython initialized");
        }
      };
    }
  }
  
  /**
   * Apply settings to UI elements
   */
  function applySettings() {
    if (_settings) {
      // Apply settings to UI elements
      $("#defaultDecimalPlaces").val(_settings.defaultDecimalPlaces || 2);
      $("#defaultNumberFormat").val(_settings.defaultNumberFormat || "decimal");
      $("#autoCalculate").prop("checked", _settings.autoCalculate !== false);
      $("#storeResultsHistory").prop("checked", _settings.storeResultsHistory !== false);
      $("#showFunctionTooltips").prop("checked", _settings.showFunctionTooltips !== false);
    }
  }
  
  /**
   * Initialize event listeners
   */
  function initializeEventListeners() {
    // Calculation tab listeners
    $("#addCalculationBtn, #startNewCalculationBtn").on("click", newCalculation);
    $("#calculationSearch").on("keyup", function() {
      loadCalculations($(this).val());
    });
    $("#calculationType").on("change", updateCalculationTypeUI);
    $("#calculationForm").on("submit", saveCalculationForm);

    $("#saveCalculationBtn").on("click", function(e) {
      e.preventDefault();
      console.log("Save calculation button clicked");
      
      // Get values from the form
      const title = $("#calculationTitle").val().trim();
      const description = $("#calculationDesc").val();
      const tags = $("#calculationTags").val();
      const type = $("#calculationType").val();
      
      // Basic validation
      if (!title) {
        alert("Please enter a title for the calculation");
        return;
      }
      
      // Create calculation object
      const calculation = {
        title: title,
        description: description,
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        type: type,
        // Add other properties as needed
        parameters: _currentCalculation ? _currentCalculation.parameters || [] : [],
        // Other properties from your form
      };
      
      // If editing existing calculation
      if (_currentCalculation && _currentCalculation.id) {
        calculation.id = _currentCalculation.id;
      }
      
      // Save to database
      window.calculationsDB.calculations.save(calculation)
        .then(savedCalculation => {
          console.log("Calculation saved successfully:", savedCalculation);
          _currentCalculation = savedCalculation;
          
          // Switch to execution view
          $("#calculationForm").hide();
          loadCalculationExecution(savedCalculation.id);
          loadCalculations(); // Refresh the list
        })
        .catch(error => {
          console.error("Error saving calculation:", error);
          alert("Error saving calculation: " + error.message);
        });
    });

    $("#cancelCalculationBtn").on("click", cancelCalculationEdit);
    $("#deleteCalculationBtn").on("click", deleteCurrentCalculation);
    
    // Parameter handling
    $("#addParamBtn").on("click", showAddParameterModal);
    $("#addParamGroupBtn").on("click", addParameterGroup);
    $("#saveParameterBtn").on("click", saveParameter);
    $("#paramType").on("change", updateParameterTypeUI);
    
    // Add event listener for parameter type radios in the modal
    $(document).on("change", ".type-specific-options", function() {
      updateParameterTypeUI();
    });
    
    // Function tab listeners
    $("#addFunctionBtn, #startNewFunctionBtn").on("click", newFunction);
    $("#functionSearch").on("keyup", function() {
      loadFunctions($(this).val());
    });
    $("#functionForm").on("submit", saveFunctionForm);
    $("#testFunctionBtn").on("click", testCurrentFunction);
    $("#cancelFunctionBtn").on("click", cancelFunctionEdit);
    $("#deleteFunctionBtn").on("click", deleteCurrentFunction);
    $("#functionParams").on("input", updateFunctionSignature);
    $("#functionName").on("input", updateFunctionSignature);
    
    // Settings tab listeners
    $("#generalSettingsForm").on("submit", saveGeneralSettings);
    $("#openaiSettingsForm").on("submit", saveOpenAISettings);
    $("#toggleApiKeyBtn").on("click", toggleApiKeyVisibility);
    $("#testApiBtn").on("click", testOpenAIConnection);
    $("#enableBrython").on("change", toggleBrythonSettings);
    $("#saveBrythonSettingsBtn").on("click", saveBrythonSettings);
    
    // Import/Export listeners
    $("#exportAllBtn").on("click", exportAllData);
    $("#exportCalculationsBtn").on("click", exportCalculations);
    $("#exportFunctionsBtn").on("click", exportFunctions);
    $("#importFile").on("change", handleImportFile);
    $("#clearAllDataBtn").on("click", confirmClearAllData);
    
    // Execution view listeners
    $("#editCalculationBtn").on("click", editCurrentCalculation);
    $("#refreshCalculationBtn").on("click", refreshCalculation);
    $("#showDebugInfo").on("change", toggleDebugInfo);
    $("#copyResultBtn").on("click", copyResultToClipboard);
    $("#exportResultBtn").on("click", exportCalculationResult);
    $("#clearHistoryBtn").on("click", clearCalculationHistory);
    $("#exportHistoryBtn").on("click", exportCalculationHistory);
    $("#shareCalculationBtn").on("click", shareCalculation);
    $("#recalculateBtn").on("click", recalculateDependencies);
    
    // Variable browser listeners
    $("#variableSearch, #modalVariableSearch").on("keyup", function() {
      var searchTerm = $(this).val();
      const isModal = $(this).attr("id") === "modalVariableSearch";
      filterVariableBrowser(searchTerm, isModal);
    });
    $("#clearVariableSearch, #modalClearVariableSearch").on("click", function() {
      const isModal = $(this).attr("id") === "modalClearVariableSearch";
      const searchInput = isModal ? $("#modalVariableSearch") : $("#variableSearch");
      searchInput.val("");
      filterVariableBrowser("", isModal);
    });
    
    // Show more functions button
    $("#showMoreFunctionsBtn").on("click", showAllBuiltinFunctions);
    
    // AI assistance buttons
    $("#aiSuggestParamsBtn").on("click", suggestParameters);
    $("#aiHelpBtn").on("click", getAICodeAssistance);
    
    // Test calculation button
    $("#testCalculationBtn").on("click", testCalculation);
    
    // Equation help buttons
    $("#browseVariablesBtn").on("click", openVariableBrowser);
    $("#insertFunctionBtn").on("click", openFunctionBrowser);
    
    // Button to show examples
    $("#showJsExampleBtn").on("click", function(e) {
      e.preventDefault();
      $("#jsExampleCode").toggle();
    });
    $("#showPyExampleBtn").on("click", function(e) {
      e.preventDefault();
      $("#pyExampleCode").toggle();
    });
    
    // History period buttons
    $("#historyDay, #historyWeek, #historyMonth, #historyYear").on("click", function() {
      const period = $(this).data("period");
      
      // Update active state
      $(this).siblings().removeClass("active");
      $(this).addClass("active");
      
      // Load history for selected period
      loadCalculationHistory(period);
    });
  }
  
  /**
   * Load calculations list with optional search filter
   * @param {string} searchTerm - Optional search term to filter calculations
   */
  function loadCalculations(searchTerm = "") {
    window.calculationsDB.calculations.getAll({ searchTerm })
      .then(calculations => {
        const listContainer = $("#calculationList");
        listContainer.empty();
        
        if (calculations.length === 0) {
          listContainer.append(`
            <li class="list-group-item text-center text-muted">
              <em>No calculations found${searchTerm ? ' for "' + searchTerm + '"' : ''}</em>
            </li>
          `);
          return;
        }
        
        calculations.forEach(calculation => {
          const listItem = $(`
            <li class="list-group-item calculation-list-item" data-id="${calculation.id}">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <strong>${escapeHtml(calculation.title)}</strong>
                  <div class="small text-muted">
                    ${calculation.type === "standard" ? 
                      '<i class="fas fa-calculator"></i> Standard' : 
                      (calculation.type === "custom-js" ? 
                        '<i class="fab fa-js"></i> JavaScript' : 
                        '<i class="fab fa-python"></i> Python')}
                    ${calculation.isPublic ? 
                      '<span class="badge badge-info ml-2">Public</span>' : ''}
                    <span class="ml-2">${formatDate(calculation.updated)}</span>
                  </div>
                </div>
                <div class="btn-group">
                  <button class="btn btn-sm btn-outline-primary execute-calculation-btn">
                    <i class="fas fa-play"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-secondary edit-calculation-btn">
                    <i class="fas fa-edit"></i>
                  </button>
                </div>
              </div>
              ${calculation.tags && calculation.tags.length ? 
                `<div class="mt-1">
                  ${calculation.tags.map(tag => 
                    `<span class="badge badge-secondary mr-1">${escapeHtml(tag)}</span>`
                  ).join('')}
                </div>` : 
                ''}
            </li>
          `);
          
          // Set up event handlers
          listItem.on("click", function() {
            loadCalculationExecution(calculation.id);
          });
          
          listItem.find(".execute-calculation-btn").on("click", function(e) {
            e.stopPropagation();
            loadCalculationExecution(calculation.id);
          });
          
          listItem.find(".edit-calculation-btn").on("click", function(e) {
            e.stopPropagation();
            loadCalculationEdit(calculation.id);
          });
          
          listContainer.append(listItem);
        });
      })
      .catch(error => {
        console.error("Error loading calculations:", error);
        showNotification("Error loading calculations: " + error.message, "danger");
      });
  }
  
  /**
   * Create a new calculation
   */
  function newCalculation() {
    _currentCalculation = {
      title: "",
      description: "",
      type: "standard",
      parameters: [],
      equation: "",
      tags: [],
      storeHistory: true,
      isPublic: false,
      resultFormat: "auto",
      decimalPlaces: _settings.defaultDecimalPlaces || 2,
      numberFormat: _settings.defaultNumberFormat || "decimal"
    };
    
    showCalculationEditForm();
    
    // Set default editor content
    _codeEditors.customJS.setValue("// Custom JavaScript calculation\n\n// Your code here\n\n// Return the result\nreturn result;");
    
    if (_codeEditors.customPython) {
      _codeEditors.customPython.setValue("# Custom Python calculation\n\n# Your code here\n\n# Return the result\nresult = 0\nreturn result");
    }
    
    // Show empty state
    $("#parametersContainer").empty();
    $("#noParametersMessage").show();
    
    // Clear dependencies
    $("#dependenciesContainer").html(`<p class="text-muted mb-0">No dependencies detected</p>`);
    
    // Update the form UI
    updateCalculationTypeUI();
  }
  
  /**
   * Show calculation edit form
   */
  function showCalculationEditForm() {
    // Hide execution view and show form
    $("#emptyCalculationState").hide();
    $("#calculationExecution").hide();
    $("#calculationForm").show();
    // Show correct buttons
    if (_currentCalculation.id) {
      $("#deleteCalculationBtn").show();
    } else {
      $("#deleteCalculationBtn").hide();
    }
    
    // Set form title
    $("#calculationForm button[type=submit]").text(_currentCalculation.id ? "Update Calculation" : "Save Calculation");
    
    // Fill form fields
    $("#calculationTitle").val(_currentCalculation.title || "");
    $("#calculationDesc").val(_currentCalculation.description || "");
    $("#calculationType").val(_currentCalculation.type || "standard");
    $("#calculationTags").val(_currentCalculation.tags ? _currentCalculation.tags.join(", ") : "");
    $("#isPublic").prop("checked", _currentCalculation.isPublic === true);
    $("#equationInput").val(_currentCalculation.equation || "");
    $("#resultFormat").val(_currentCalculation.resultFormat || "auto");
    $("#decimalPlaces").val(_currentCalculation.decimalPlaces !== undefined ? _currentCalculation.decimalPlaces : (_settings.defaultDecimalPlaces || 2));
    $("#numberFormat").val(_currentCalculation.numberFormat || (_settings.defaultNumberFormat || "decimal"));
    $("#resultUnit").val(_currentCalculation.resultUnit || "");
    $("#resultPrefix").val(_currentCalculation.resultPrefix || "");
    $("#resultSuffix").val(_currentCalculation.resultSuffix || "");
    $("#storeHistory").prop("checked", _currentCalculation.storeHistory !== false);
    $("#showChart").prop("checked", _currentCalculation.showChart === true);
    
    // Update code editors
    if (_currentCalculation.customCode) {
      if (_currentCalculation.type === "custom-js") {
        _codeEditors.customJS.setValue(_currentCalculation.customCode);
      } else if (_currentCalculation.type === "custom-py" && _codeEditors.customPython) {
        _codeEditors.customPython.setValue(_currentCalculation.customCode);
      }
    }
    
    // Update the form UI
    updateCalculationTypeUI();
    
    // Set active tab to Basic
    $("#calculationTabs a[href='#basicSettings']").tab('show');
    
    // Load parameters if they exist
    if (_currentCalculation.parameters && _currentCalculation.parameters.length > 0) {
      $("#parametersContainer").empty();
      $("#noParametersMessage").hide();
      
      _currentCalculation.parameters.forEach(param => {
        renderParameter(param);
      });
    }
    
    // Analyze dependencies
    analyzeDependencies();
  }
  
  /**
   * Load a calculation for editing
   * @param {number} calculationId - ID of the calculation to edit
   */
  function loadCalculationEdit(calculationId) {
    window.calculationsDB.calculations.get(calculationId)
      .then(calculation => {
        if (!calculation) {
          throw new Error("Calculation not found");
        }
        
        _currentCalculation = calculation;
        showCalculationEditForm();
      })
      .catch(error => {
        console.error("Error loading calculation:", error);
        showNotification("Error loading calculation: " + error.message, "danger");
      });
  }
  
  /**
   * Load a calculation for execution
   * @param {number} calculationId - ID of the calculation to execute
   */
  function loadCalculationExecution(calculationId) {
    window.calculationsDB.calculations.get(calculationId)
      .then(calculation => {
        if (!calculation) {
          throw new Error("Calculation not found");
        }
        
        _currentCalculation = calculation;
        
        // Hide form and show execution view
        $("#emptyCalculationState").hide();
        $("#calculationForm").hide();
        $("#calculationExecution").show();
        
        // Update the header info
        $("#executionTitle").text(calculation.title);
        $("#executionDesc").text(calculation.description || "");
        $("#calculationId").text(calculation.id);
        
        // Get last calculated time
        const cachedResult = window.calculationsEngine.getCachedResult(calculation.id);
        if (cachedResult) {
          $("#lastCalculated").text(formatDateTime(cachedResult.timestamp));
        } else {
          $("#lastCalculated").text("Never");
        }
        
        // Render parameters
        renderExecutionParameters();
        
        // Check cache status
        window.calculationsEngine.checkCacheStatus(calculation.id)
          .then(cacheStatus => {
            if (!cacheStatus.isUpToDate && cachedResult) {
              // Show dependency warning
              $("#dependencyWarning").show();
            } else {
              $("#dependencyWarning").hide();
            }
            
            // Load calculation history
            return loadCalculationHistory();
          })
          .then(() => {
            // Execute the calculation if auto-calculate is enabled
            if (_settings.autoCalculate !== false) {
              executeCalculation();
            }
          });
      })
      .catch(error => {
        console.error("Error loading calculation:", error);
        showNotification("Error loading calculation: " + error.message, "danger");
      });
  }
  
  /**
   * Render parameters for execution view
   */
  function renderExecutionParameters() {
    const container = $("#parametersExecutionContainer");
    container.empty();
    
    if (!_currentCalculation.parameters || _currentCalculation.parameters.length === 0) {
      container.html('<p class="text-center text-muted">No parameters defined for this calculation.</p>');
      return;
    }
    
    // Group parameters by group name
    const groupedParams = {};
    const advancedParams = [];
    
    _currentCalculation.parameters.forEach(param => {
      if (param.advanced) {
        advancedParams.push(param);
      } else if (param.group) {
        if (!groupedParams[param.group]) {
          groupedParams[param.group] = [];
        }
        groupedParams[param.group].push(param);
      } else {
        if (!groupedParams["main"]) {
          groupedParams["main"] = [];
        }
        groupedParams["main"].push(param);
      }
    });
    
    // Render main parameters
    if (groupedParams["main"]) {
      const mainGroup = $('<div class="param-group"></div>');
      groupedParams["main"].forEach(param => {
        mainGroup.append(renderExecutionParameter(param));
      });
      container.append(mainGroup);
    }
    
    // Render parameter groups
    Object.keys(groupedParams).forEach(groupName => {
      if (groupName === "main") return;
      
      const group = $(`
        <div class="param-group">
          <h6 class="param-heading">${escapeHtml(groupName)}</h6>
          <div class="param-group-content"></div>
        </div>
      `);
      
      groupedParams[groupName].forEach(param => {
        group.find(".param-group-content").append(renderExecutionParameter(param));
      });
      
      container.append(group);
    });
    
    // Render advanced parameters if any
    if (advancedParams.length > 0) {
      const advancedGroup = $(`
        <div class="mt-4">
          <a data-toggle="collapse" href="#advancedParamsCollapse" role="button" aria-expanded="false">
            <i class="fas fa-cog"></i> Advanced Parameters
          </a>
          <div class="collapse mt-2" id="advancedParamsCollapse">
            <div class="param-group">
              <div class="param-group-content"></div>
            </div>
          </div>
        </div>
      `);
      
      advancedParams.forEach(param => {
        advancedGroup.find(".param-group-content").append(renderExecutionParameter(param));
      });
      
      container.append(advancedGroup);
    }
  }
  
  /**
   * Render a single parameter for execution view
   * @param {Object} param - Parameter object
   * @returns {jQuery} The rendered parameter element
   */
  function renderExecutionParameter(param) {
    const inputId = `param-${param.name}`;
    let paramHtml = $(`
      <div class="form-group execution-parameter" data-param-name="${param.name}">
        <label for="${inputId}">${escapeHtml(param.label || param.name)}</label>
        <div class="parameter-input-container"></div>
        ${param.description ? `<small class="form-text text-muted">${escapeHtml(param.description)}</small>` : ''}
      </div>
    `);
    
    const inputContainer = paramHtml.find(".parameter-input-container");
    
    // Get cached value if available
    const cachedResult = window.calculationsEngine.getCachedResult(_currentCalculation.id);
    const cachedValue = cachedResult && cachedResult.params ? cachedResult.params[param.name] : undefined;
    
    // Set default value either from cached parameters or parameter definition
    const defaultValue = cachedValue !== undefined ? cachedValue : param.defaultValue;
    
    switch (param.type) {
      case "number":
        const numberInput = $(`
          <div class="input-group">
            <input type="number" class="form-control param-number" id="${inputId}" 
              value="${defaultValue !== undefined ? defaultValue : ''}"
              ${param.step ? `step="${param.step}"` : ''}
              ${param.min !== undefined ? `min="${param.min}"` : ''}
              ${param.max !== undefined ? `max="${param.max}"` : ''}
              ${param.required ? 'required' : ''}>
            ${param.unit ? `<div class="input-group-append">
              <span class="input-group-text">${escapeHtml(param.unit)}</span>
            </div>` : ''}
          </div>
        `);
        
        // Add event listener for auto-calculation
        numberInput.find("input").on("change", function() {
          if (_settings.autoCalculate !== false) {
            executeCalculation();
          }
        });
        
        inputContainer.append(numberInput);
        break;
        
      case "text":
        const textInput = $(`
          <input type="text" class="form-control param-text" id="${inputId}" 
            value="${defaultValue !== undefined ? escapeHtml(defaultValue) : ''}"
            ${param.placeholder ? `placeholder="${escapeHtml(param.placeholder)}"` : ''}
            ${param.pattern ? `pattern="${param.pattern}"` : ''}
            ${param.required ? 'required' : ''}>
        `);
        
        // Add event listener for auto-calculation
        textInput.on("change", function() {
          if (_settings.autoCalculate !== false) {
            executeCalculation();
          }
        });
        
        inputContainer.append(textInput);
        break;
        
      case "boolean":
        const boolInput = $(`
          <div class="custom-control custom-switch">
            <input type="checkbox" class="custom-control-input param-boolean" id="${inputId}" 
              ${defaultValue ? 'checked' : ''}>
            <label class="custom-control-label" for="${inputId}">
              ${defaultValue ? (param.trueLabel || "Yes") : (param.falseLabel || "No")}
            </label>
          </div>
        `);
        
        // Add event listener for auto-calculation and label update
        boolInput.find("input").on("change", function() {
          const isChecked = $(this).prop("checked");
          const label = isChecked ? (param.trueLabel || "Yes") : (param.falseLabel || "No");
          $(this).siblings("label").text(label);
          
          if (_settings.autoCalculate !== false) {
            executeCalculation();
          }
        });
        
        inputContainer.append(boolInput);
        break;
        
      case "select":
        if (!param.options || param.options.length === 0) {
          inputContainer.append('<p class="text-danger">No options defined for this parameter</p>');
          break;
        }
        
        const selectInput = $(`
          <select class="form-control param-select" id="${inputId}" ${param.required ? 'required' : ''}>
            ${param.options.map(option => `
              <option value="${escapeHtml(option.value)}" 
                ${option.value === defaultValue ? 'selected' : ''}>
                ${escapeHtml(option.label || option.value)}
              </option>
            `).join('')}
          </select>
        `);
        
        // Add event listener for auto-calculation
        selectInput.on("change", function() {
          if (_settings.autoCalculate !== false) {
            executeCalculation();
          }
        });
        
        inputContainer.append(selectInput);
        break;
        
      case "date":
        const dateInput = $(`
          <input type="date" class="form-control param-date" id="${inputId}" 
            value="${defaultValue || ''}"
            ${param.min ? `min="${param.min}"` : ''}
            ${param.max ? `max="${param.max}"` : ''}
            ${param.required ? 'required' : ''}>
        `);
        
        // Add event listener for auto-calculation
        dateInput.on("change", function() {
          if (_settings.autoCalculate !== false) {
            executeCalculation();
          }
        });
        
        inputContainer.append(dateInput);
        break;
        
      case "calculation":
        // For calculation references, show the reference with a refresh button
        const refCalcId = param.calcReference;
        let refCalcTitle = "Loading...";
        
        // Fetch the referenced calculation name
        if (refCalcId) {
          window.calculationsDB.calculations.get(parseInt(refCalcId))
            .then(refCalc => {
              if (refCalc) {
                refCalcTitle = refCalc.title;
                calcRefDisplay.find(".calculation-reference-name").text(refCalcTitle);
              } else {
                refCalcTitle = "Unknown calculation";
                calcRefDisplay.find(".calculation-reference-name").text(refCalcTitle);
                calcRefDisplay.find(".text-muted").text("Referenced calculation not found");
              }
            })
            .catch(error => {
              console.error("Error loading referenced calculation:", error);
              calcRefDisplay.find(".calculation-reference-name").text("Error");
              calcRefDisplay.find(".text-muted").text("Error loading reference: " + error.message);
            });
        } else {
          refCalcTitle = "No calculation selected";
        }
        
        const calcRefDisplay = $(`
          <div class="card bg-light calculation-reference" id="${inputId}">
            <div class="card-body py-2">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <span class="calculation-reference-name">${refCalcTitle}</span>
                  <small class="d-block text-muted">
                    ${refCalcId ? `Referenced calculation ID: ${refCalcId}` : 'No calculation selected'}
                    ${param.resultProperty ? `, Property: ${param.resultProperty}` : ''}
                  </small>
                </div>
                <div class="btn-group">
                  <button type="button" class="btn btn-sm btn-outline-secondary refresh-reference-btn">
                    <i class="fas fa-sync-alt"></i>
                  </button>
                  <button type="button" class="btn btn-sm btn-outline-primary view-reference-btn">
                    <i class="fas fa-external-link-alt"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `);
        
        // Add event listeners for reference buttons
        calcRefDisplay.find(".refresh-reference-btn").on("click", function() {
          // Clear cache for the referenced calculation and recalculate
          if (refCalcId) {
            window.calculationsEngine.clearCalculationCache(parseInt(refCalcId));
            if (_settings.autoCalculate !== false) {
              executeCalculation();
            }
          }
        });
        
        calcRefDisplay.find(".view-reference-btn").on("click", function() {
          if (refCalcId) {
            loadCalculationExecution(parseInt(refCalcId));
          }
        });
        
        inputContainer.append(calcRefDisplay);
        break;
        
      default:
        inputContainer.append(`<p class="text-danger">Unknown parameter type: ${param.type}</p>`);
    }
    
    return paramHtml;
  }
  
  /**
   * Execute the current calculation
   */
  function executeCalculation() {
    if (!_currentCalculation) {
      showNotification("No calculation selected", "warning");
      return;
    }
    
    // Show loading indicator
    $("#resultValue").html('<span class="loading-spinner"></span>');
    $("#errorContainer").hide();
    
    // Get parameter values
    const paramValues = getParameterValues();
    
    // Execute calculation
    window.calculationsEngine.executeCalculation(_currentCalculation, paramValues, { detailed: true })
      .then(result => {
        // Update the UI with the result
        displayCalculationResult(result);
        
        // Hide dependency warning
        $("#dependencyWarning").hide();
        
        // Update last calculated time
        $("#lastCalculated").text(formatDateTime(new Date()));
        
        // Update history chart if enabled
        if (_currentCalculation.showChart) {
          loadHistoryChart();
        }
      })
      .catch(error => {
        // Show error message
        $("#errorContainer").show();
        $("#errorMessage").text(error.message);
        
        // Clear result
        $("#resultValue").text("-");
        $("#resultUnitDisplay").text("");
        
        console.error("Calculation error:", error);
      });
  }
  
  /**
   * Get current parameter values from the execution view
   * @returns {Object} Parameter values object
   */
  function getParameterValues() {
    const paramValues = {};
    
    $(".execution-parameter").each(function() {
      const paramName = $(this).data("param-name");
      const paramType = _currentCalculation.parameters.find(p => p.name === paramName)?.type;
      
      switch (paramType) {
        case "number":
          const numValue = $(this).find(".param-number").val();
          paramValues[paramName] = numValue !== "" ? parseFloat(numValue) : undefined;
          break;
          
        case "text":
          paramValues[paramName] = $(this).find(".param-text").val();
          break;
          
        case "boolean":
          paramValues[paramName] = $(this).find(".param-boolean").prop("checked");
          break;
          
        case "select":
          paramValues[paramName] = $(this).find(".param-select").val();
          break;
          
        case "date":
          const dateValue = $(this).find(".param-date").val();
          paramValues[paramName] = dateValue ? new Date(dateValue) : undefined;
          break;
          
        // For calculation references, values will be resolved by the calculation engine
      }
    });
    
    return paramValues;
  }
  
  /**
   * Display calculation result
   * @param {Object} resultData - Result data from calculation engine
   */
  function displayCalculationResult(resultData) {
    const result = resultData.formattedResult;
    
    // Handle different result types
    if (typeof result === "object" && result !== null) {
      // For object/array results, display the primary result and detailed results
      let primaryValue = "";
      
      if (Array.isArray(result)) {
        primaryValue = `Array (${result.length} items)`;
      } else {
        primaryValue = `Object (${Object.keys(result).length} properties)`;
      }
      
      $("#resultValue").text(primaryValue);
      
      // Show detailed results
      displayDetailedResults(result);
      $("#advancedResults").show();
    } else {
      // For simple values, just display them
      $("#resultValue").text(result);
      $("#advancedResults").hide();
    }
    
    // Display units and prefix/suffix if set
    $("#resultUnitDisplay").text(_currentCalculation.resultUnit || "");
    $("#resultPrefix").text(_currentCalculation.resultPrefix || "");
    $("#resultSuffix").text(_currentCalculation.resultSuffix || "");
    
    // Show calculation details if debug info is enabled
    if ($("#showDebugInfo").prop("checked")) {
      updateDebugInfo(resultData);
    }
  }
  
  /**
   * Display detailed results for object/array values
   * @param {Object|Array} result - The calculation result
   */
  function displayDetailedResults(result) {
    const tableBody = $("#resultsTableBody");
    tableBody.empty();
    
    if (Array.isArray(result)) {
      // For arrays, show each item
      result.forEach((item, index) => {
        tableBody.append(`
          <tr>
            <td>Item ${index}</td>
            <td>${formatResultItem(item)}</td>
            <td>${_currentCalculation.resultUnit || ""}</td>
          </tr>
        `);
      });
    } else {
      // For objects, show each property
      Object.entries(result).forEach(([key, value]) => {
        tableBody.append(`
          <tr>
            <td>${escapeHtml(key)}</td>
            <td>${formatResultItem(value)}</td>
            <td>${_currentCalculation.resultUnit || ""}</td>
          </tr>
        `);
      });
    }
  }
  
  /**
   * Format a result item for display
   * @param {*} item - The item to format
   * @returns {string} Formatted item for display
   */
  function formatResultItem(item) {
    if (typeof item === "object" && item !== null) {
      return `<span class="text-muted">${Array.isArray(item) ? "Array" : "Object"}</span>`;
    } else {
      return escapeHtml(String(item));
    }
  }
  
  /**
   * Update debug information display
   * @param {Object} resultData - Result data from calculation engine
   */
  function updateDebugInfo(resultData) {
    // Show executed code
    let executedCode = "";
    switch (_currentCalculation.type) {
      case "standard":
        executedCode = `// Standard equation\nmath.evaluate("${_currentCalculation.equation}", parameters);`;
        break;
      case "custom-js":
        executedCode = _currentCalculation.customCode || "// No code available";
        break;
      case "custom-py":
        executedCode = _currentCalculation.customCode || "# No code available";
        break;
    }
    
    $("#executedCodeContent").text(executedCode);
    
    // Show parameter values
    $("#parameterValuesContent").text(JSON.stringify(resultData.parameters, null, 2));
    
    // Show execution log
    const logContent = resultData.log.map(entry => 
      `[${new Date(entry.timestamp).toLocaleTimeString()}] ${
        Array.isArray(entry.message) ? entry.message.map(m => 
          typeof m === 'object' ? JSON.stringify(m, null, 2) : m
        ).join(' ') : entry.message
      }`
    ).join('\n');
    
    $("#executionLogContent").text(logContent);
  }
  
  /**
   * Toggle debug information display
   */
  function toggleDebugInfo() {
    const showDebug = $("#showDebugInfo").prop("checked");
    $("#debugInfo").toggle(showDebug);
  }
  
  /**
   * Save the current calculation form
   * @param {Event} event - Form submit event
   */
  function saveCalculationForm(event) {
    event.preventDefault();
    
    // Get form values
    const title = $("#calculationTitle").val().trim();
    if (!title) {
      showNotification("Title is required", "warning");
      return;
    }
    
    const description = $("#calculationDesc").val().trim();
    const type = $("#calculationType").val();
    const tagsStr = $("#calculationTags").val().trim();
    const tags = tagsStr ? tagsStr.split(",").map(t => t.trim()) : [];
    const isPublic = $("#isPublic").prop("checked");
    
    // Get type-specific values
    let equation = "";
    let customCode = "";
    
    switch (type) {
      case "standard":
        equation = $("#equationInput").val().trim();
        if (!equation) {
          showNotification("Equation is required for standard calculations", "warning");
          return;
        }
        break;
        
      case "custom-js":
        customCode = _codeEditors.customJS.getValue();
        if (!customCode) {
          showNotification("Code is required for custom JavaScript calculations", "warning");
          return;
        }
        break;
        
      case "custom-py":
        customCode = _codeEditors.customPython ? _codeEditors.customPython.getValue() : "";
        if (!customCode) {
          showNotification("Code is required for custom Python calculations", "warning");
          return;
        }
        break;
    }
    
    // Result formatting options
    const resultFormat = $("#resultFormat").val();
    const decimalPlaces = parseInt($("#decimalPlaces").val());
    const numberFormat = $("#numberFormat").val();
    const resultUnit = $("#resultUnit").val().trim();
    const resultPrefix = $("#resultPrefix").val().trim();
    const resultSuffix = $("#resultSuffix").val().trim();
    const storeHistory = $("#storeHistory").prop("checked");
    const showChart = $("#showChart").prop("checked");
    
    // Update the current calculation
    _currentCalculation.title = title;
    _currentCalculation.description = description;
    _currentCalculation.type = type;
    _currentCalculation.tags = tags;
    _currentCalculation.isPublic = isPublic;
    _currentCalculation.equation = equation;
    _currentCalculation.customCode = customCode;
    _currentCalculation.resultFormat = resultFormat;
    _currentCalculation.decimalPlaces = decimalPlaces;
    _currentCalculation.numberFormat = numberFormat;
    _currentCalculation.resultUnit = resultUnit;
    _currentCalculation.resultPrefix = resultPrefix;
    _currentCalculation.resultSuffix = resultSuffix;
    _currentCalculation.storeHistory = storeHistory;
    _currentCalculation.showChart = showChart;
    
    // Save to database
    window.calculationsDB.calculations.save(_currentCalculation)
    .then(savedCalculation => {
      console.log("Calculation saved successfully:", savedCalculation);
      _currentCalculation = savedCalculation;
      showNotification("Calculation saved successfully", "success");
      loadCalculations();
      loadCalculationExecution(savedCalculation.id);
    })
    .catch(error => {
      console.error("Error saving calculation:", error);
      showNotification("Error saving calculation: " + error.message, "danger");
    });
  }
  
  /**
   * Cancel editing the current calculation
   */
  function cancelCalculationEdit() {
    if (_currentCalculation && _currentCalculation.id) {
      // Return to execution view
      loadCalculationExecution(_currentCalculation.id);
    } else {
      // Return to empty state
      _currentCalculation = null;
      $("#calculationForm").hide();
      $("#calculationExecution").hide();
      $("#emptyCalculationState").show();
    }
  }
  
  /**
   * Delete the current calculation
   */
  function deleteCurrentCalculation() {
    if (!_currentCalculation || !_currentCalculation.id) {
      return;
    }
    
    if (confirm(`Are you sure you want to delete the calculation "${_currentCalculation.title}"?`)) {
      window.calculationsDB.calculations.delete(_currentCalculation.id)
        .then(() => {
          showNotification(`Calculation "${_currentCalculation.title}" deleted`, "success");
          
          // Clear current calculation
          _currentCalculation = null;
          
          // Reload the calculations list
          loadCalculations();
          
          // Show empty state
          $("#calculationForm").hide();
          $("#calculationExecution").hide();
          $("#emptyCalculationState").show();
        })
        .catch(error => {
          console.error("Error deleting calculation:", error);
          showNotification("Error deleting calculation: " + error.message, "danger");
        });
    }
  }
  
  /**
   * Update the UI based on the selected calculation type
   */
  function updateCalculationTypeUI() {
    const type = $("#calculationType").val();
    
    // Show/hide appropriate sections based on type
    switch (type) {
      case "standard":
        $(".standard-equation").show();
        $(".custom-code").hide();
        break;
        
      case "custom-js":
        $(".standard-equation").hide();
        $(".custom-code").hide(); // Hide first to ensure proper refresh
        $(".custom-code").show();
        $("#customJsEditor").show();
        $("#customPyEditor").hide();
        _codeEditors.customJS.refresh();
        break;
        
      case "custom-py":
        $(".standard-equation").hide();
        $(".custom-code").hide(); // Hide first to ensure proper refresh
        $(".custom-code").show();
        $("#customJsEditor").hide();
        $("#customPyEditor").show();
        if (_codeEditors.customPython) {
          _codeEditors.customPython.refresh();
        }
        break;
    }
  }
  
  /**
   * Analyze calculation dependencies
   */
  function analyzeDependencies() {
    if (!_currentCalculation || !_currentCalculation.id) {
      return;
    }
    
    window.calculationsEngine.getCalculationDependencies(_currentCalculation.id)
      .then(dependencies => {
        if (dependencies.length === 0) {
          $("#dependenciesContainer").html(`<p class="text-muted mb-0">No dependencies detected</p>`);
          return;
        }
        
        // Fetch details for each dependency
        const dependencyPromises = dependencies.map(depId => 
          window.calculationsDB.calculations.get(depId)
        );
        
        return Promise.all(dependencyPromises);
      })
      .then(dependencyCalcs => {
        if (!dependencyCalcs || dependencyCalcs.length === 0) {
          return;
        }
        
        // Display dependencies
        let html = `<ul class="list-group">`;
        dependencyCalcs.forEach(calc => {
          if (!calc) return;
          
          html += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <i class="fas fa-calculator mr-2"></i>
                ${escapeHtml(calc.title)}
              </div>
              <button class="btn btn-sm btn-outline-primary view-dependency-btn" data-id="${calc.id}">
                <i class="fas fa-external-link-alt"></i> View
              </button>
            </li>
          `;
        });
        html += `</ul>`;
        
        $("#dependenciesContainer").html(html);
        // Add event handlers for dependency buttons
        $(".view-dependency-btn").on("click", function() {
          const depId = $(this).data("id");
          loadCalculationExecution(depId);
        });
      })
      .catch(error => {
        console.error("Error analyzing dependencies:", error);
        $("#dependenciesContainer").html(`
          <p class="text-danger mb-0">Error analyzing dependencies: ${error.message}</p>
        `);
      });
  }
  
  /**
   * Show the add parameter modal
   */
  function showAddParameterModal() {
    // Reset the modal form
    $("#newParameterModal .modal-title").text("Add Parameter");
    $("#saveParameterBtn").text("Add Parameter");
    
    // Clear form fields
    $("#paramName").val("").prop("disabled", false);
    $("#paramLabel").val("");
    $("#paramType").val("number");
    $("#paramDescription").val("");
    $("#defaultValue").val("");
    $("#paramUnit").val("");
    $("#minValue").val("");
    $("#maxValue").val("");
    $("#stepValue").val("");
    $("#decimalDisplay").val("2");
    $("#textDefaultValue").val("");
    $("#placeholder").val("");
    $("#textPattern").val("");
    $("#boolDefaultValue").prop("checked", false);
    $("#trueLabel").val("Yes");
    $("#falseLabel").val("No");
    $("#calcReference").empty().append('<option value="">Select a calculation</option>');
    $("#resultProperty").val("");
    $("#paramRequired").prop("checked", false);
    $("#paramAdvanced").prop("checked", false);
    
    // Load available calculations for reference parameter
    window.calculationsDB.calculations.getAll({ isPublic: true })
      .then(calculations => {
        calculations.forEach(calc => {
          // Don't include the current calculation
          if (_currentCalculation && calc.id === _currentCalculation.id) {
            return;
          }
          
          $("#calcReference").append(`
            <option value="${calc.id}">${escapeHtml(calc.title)}</option>
          `);
        });
      })
      .catch(error => {
        console.error("Error loading public calculations:", error);
      });
    
    // Reset options for select type
    $("#selectOptionsContainer").html(`
      <div class="input-group mb-2 select-option">
        <input type="text" class="form-control option-value" placeholder="Value">
        <input type="text" class="form-control option-label" placeholder="Label">
        <div class="input-group-append">
          <button class="btn btn-outline-danger remove-option-btn" type="button">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `);
    
    // Update parameter type UI
    updateParameterTypeUI();
    
    // Show the modal
    $("#newParameterModal").modal("show");
  }
  
  /**
   * Update the parameter type UI based on the selected type
   */
  function updateParameterTypeUI() {
    const type = $("#paramType").val();
    
    // Hide all type-specific options
    $(".type-specific-options").hide();
    
    // Show the options for the selected type
    switch (type) {
      case "number":
        $("#numberOptions").show();
        break;
      case "text":
        $("#textOptions").show();
        break;
      case "boolean":
        $("#booleanOptions").show();
        break;
      case "select":
        $("#selectOptions").show();
        break;
      case "date":
        $("#dateOptions").show();
        break;
      case "calculation":
        $("#calculationOptions").show();
        break;
    }
  }
  
  /**
   * Add a parameter group
   */
  function addParameterGroup() {
    const groupName = prompt("Enter group name:");
    if (!groupName) return;
    
    // Add group to parameters container
    const groupHtml = $(`
      <div class="param-group" data-group-name="${escapeHtml(groupName)}">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="mb-0">${escapeHtml(groupName)}</h6>
          <div class="btn-group btn-group-sm">
            <button type="button" class="btn btn-outline-secondary add-param-to-group-btn">
              <i class="fas fa-plus"></i> Add Parameter
            </button>
            <button type="button" class="btn btn-outline-danger remove-group-btn">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="group-parameters"></div>
      </div>
    `);
    
    // Add event handlers
    groupHtml.find(".remove-group-btn").on("click", function() {
      if (confirm(`Are you sure you want to delete the group "${groupName}"?`)) {
        // Update parameters to remove group association
        if (_currentCalculation && _currentCalculation.parameters) {
          _currentCalculation.parameters.forEach(param => {
            if (param.group === groupName) {
              delete param.group;
            }
          });
        }
        
        groupHtml.remove();
      }
    });
    
    groupHtml.find(".add-param-to-group-btn").on("click", function() {
      // Open parameter modal with pre-selected group
      showAddParameterModal();
      // Set group name in modal (will need to add a hidden field for this)
      $("#paramGroupName").val(groupName);
    });
    
    $("#parametersContainer").append(groupHtml);
  }
  
  /**
   * Save a parameter from the modal form
   */
  function saveParameter() {
    const name = $("#paramName").val().trim();
    if (!name) {
      showNotification("Parameter name is required", "warning");
      return;
    }
    
    // Check if parameter name already exists
    if (_currentCalculation.parameters && !$("#paramName").prop("disabled")) {
      const exists = _currentCalculation.parameters.some(p => p.name === name);
      if (exists) {
        showNotification(`Parameter "${name}" already exists`, "warning");
        return;
      }
    }
    
    const type = $("#paramType").val();
    const label = $("#paramLabel").val().trim() || name;
    const description = $("#paramDescription").val().trim();
    const required = $("#paramRequired").prop("checked");
    const advanced = $("#paramAdvanced").prop("checked");
    const group = $("#paramGroupName").val();
    
    // Create parameter object
    const param = {
      name,
      label,
      type,
      description,
      required,
      advanced
    };
    
    // Add group if specified
    if (group) {
      param.group = group;
    }
    
    // Add type-specific properties
    switch (type) {
      case "number":
        param.defaultValue = $("#defaultValue").val() ? parseFloat($("#defaultValue").val()) : undefined;
        param.unit = $("#paramUnit").val().trim();
        param.min = $("#minValue").val() ? parseFloat($("#minValue").val()) : undefined;
        param.max = $("#maxValue").val() ? parseFloat($("#maxValue").val()) : undefined;
        param.step = $("#stepValue").val() ? parseFloat($("#stepValue").val()) : undefined;
        param.decimalPlaces = parseInt($("#decimalDisplay").val() || "2");
        break;
        
      case "text":
        param.defaultValue = $("#textDefaultValue").val();
        param.placeholder = $("#placeholder").val();
        param.pattern = $("#textPattern").val();
        break;
        
      case "boolean":
        param.defaultValue = $("#boolDefaultValue").prop("checked");
        param.trueLabel = $("#trueLabel").val() || "Yes";
        param.falseLabel = $("#falseLabel").val() || "No";
        break;
        
      case "select":
        param.defaultValue = $("#selectDefaultValue").val();
        
        // Get select options
        const options = [];
        $(".select-option").each(function() {
          const value = $(this).find(".option-value").val().trim();
          const label = $(this).find(".option-label").val().trim();
          
          if (value) {
            options.push({
              value,
              label: label || value
            });
          }
        });
        
        if (options.length === 0) {
          showNotification("Select parameters must have at least one option", "warning");
          return;
        }
        
        param.options = options;
        break;
        
      case "date":
        param.defaultValue = $("#dateDefaultValue").val();
        param.min = $("#minDate").val();
        param.max = $("#maxDate").val();
        break;
        
      case "calculation":
        param.calcReference = $("#calcReference").val();
        param.resultProperty = $("#resultProperty").val().trim();
        
        if (!param.calcReference) {
          showNotification("Calculation reference is required for calculation parameters", "warning");
          return;
        }
        break;
    }
    
    // If editing existing parameter, find and update it
    if ($("#paramName").prop("disabled")) {
      const index = _currentCalculation.parameters.findIndex(p => p.name === name);
      if (index !== -1) {
        _currentCalculation.parameters[index] = param;
        
        // Update the parameter in the UI
        $(`.parameter-item[data-param-name="${name}"]`).remove();
        renderParameter(param);
      }
    } else {
      // Add new parameter to the calculation
      if (!_currentCalculation.parameters) {
        _currentCalculation.parameters = [];
      }
      
      _currentCalculation.parameters.push(param);
      
      // Add the parameter to the UI
      renderParameter(param);
      $("#noParametersMessage").hide();
    }
    
    // Close the modal
    $("#newParameterModal").modal("hide");
  }
  
  /**
   * Render a parameter in the parameters container
   * @param {Object} param - The parameter to render
   */
  function renderParameter(param) {
    const paramHtml = $(`
      <div class="card mb-3 parameter-item" data-param-name="${param.name}">
        <div class="card-header d-flex justify-content-between align-items-center">
          <div>
            <span class="draggable-handle mr-2"><i class="fas fa-grip-vertical"></i></span>
            <strong>${escapeHtml(param.label)}</strong>
            <span class="text-muted ml-2">(${param.name})</span>
            ${param.required ? '<span class="badge badge-danger ml-2">Required</span>' : ''}
            ${param.advanced ? '<span class="badge badge-warning ml-2">Advanced</span>' : ''}
            ${param.type === 'calculation' ? '<span class="badge badge-info ml-2">Reference</span>' : ''}
          </div>
          <div class="btn-group">
            <button type="button" class="btn btn-sm btn-outline-secondary edit-param-btn">
              <i class="fas fa-edit"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger remove-param-btn">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="row">
            <div class="col-md-3">
              <strong>Type:</strong> ${getParameterTypeLabel(param.type)}
            </div>
            <div class="col-md-${param.type === 'calculation' ? '9' : '5'}">
              <strong>Default:</strong> ${formatParameterDefault(param)}
            </div>
            ${param.type !== 'calculation' ? `
            <div class="col-md-4">
              ${param.unit ? `<strong>Unit:</strong> ${escapeHtml(param.unit)}` : ''}
              ${param.min !== undefined ? `<strong>Min:</strong> ${param.min}` : ''}
              ${param.max !== undefined ? `<strong>Max:</strong> ${param.max}` : ''}
              ${(param.min !== undefined && param.max !== undefined) ? `<strong>Range:</strong> ${param.min} to ${param.max}` : ''}
            </div>` : ''}
          </div>
          ${param.description ? `<div class="mt-2">${escapeHtml(param.description)}</div>` : ''}
          ${renderParameterDetails(param)}
        </div>
      </div>
    `);
    
    // Add event handlers
    paramHtml.find(".edit-param-btn").on("click", function() {
      editParameter(param);
    });
    
    paramHtml.find(".remove-param-btn").on("click", function() {
      removeParameter(param.name);
    });
    
    // Add to the appropriate container
    if (param.group && $(`.param-group[data-group-name="${param.group}"]`).length > 0) {
      $(`.param-group[data-group-name="${param.group}"] .group-parameters`).append(paramHtml);
    } else {
      $("#parametersContainer").append(paramHtml);
    }
  }
  
  /**
   * Get a human-readable label for a parameter type
   * @param {string} type - The parameter type
   * @returns {string} The type label
   */
  function getParameterTypeLabel(type) {
    switch (type) {
      case "number": return "Number";
      case "text": return "Text";
      case "boolean": return "Boolean";
      case "select": return "Select";
      case "date": return "Date";
      case "calculation": return "Calculation";
      default: return type;
    }
  }
  
  /**
   * Format a parameter's default value for display
   * @param {Object} param - The parameter
   * @returns {string} Formatted default value
   */
  function formatParameterDefault(param) {
    if (param.defaultValue === undefined || param.defaultValue === null) {
      return '<em class="text-muted">None</em>';
    }
    
    switch (param.type) {
      case "boolean":
        return param.defaultValue ? 
          (param.trueLabel || "Yes") : 
          (param.falseLabel || "No");
        
      case "calculation":
        return `<em>From calculation #${param.calcReference}</em>`;
        
      default:
        return escapeHtml(String(param.defaultValue));
    }
  }
  
  /**
   * Render detailed information for a parameter
   * @param {Object} param - The parameter
   * @returns {string} HTML for detailed parameter information
   */
  function renderParameterDetails(param) {
    switch (param.type) {
      case "select":
        if (!param.options || param.options.length === 0) {
          return '<div class="mt-2 text-danger">No options defined</div>';
        }
        
        let optionsHtml = '<div class="mt-2"><strong>Options:</strong><ul class="mb-0">';
        param.options.forEach(option => {
          optionsHtml += `<li>${escapeHtml(option.label)} (value: ${escapeHtml(option.value)})</li>`;
        });
        optionsHtml += '</ul></div>';
        
        return optionsHtml;
        
      case "calculation":
        let refHtml = '<div class="mt-2">';
        
        // Fetch and display the referenced calculation name
        if (param.calcReference) {
          refHtml += `<strong>Referenced Calculation:</strong> <span class="calculation-reference" data-id="${param.calcReference}">Loading...</span><br>`;
          
          // Fetch the calculation name asynchronously
          window.calculationsDB.calculations.get(parseInt(param.calcReference))
            .then(calc => {
              if (calc) {
                $(`.calculation-reference[data-id="${param.calcReference}"]`).text(calc.title);
              } else {
                $(`.calculation-reference[data-id="${param.calcReference}"]`).text("Unknown calculation");
              }
            })
            .catch(error => {
              console.error("Error loading referenced calculation:", error);
              $(`.calculation-reference[data-id="${param.calcReference}"]`).text("Error loading");
            });
        } else {
          refHtml += '<strong>Referenced Calculation:</strong> <em class="text-muted">None selected</em><br>';
        }
        
        if (param.resultProperty) {
          refHtml += `<strong>Result Property:</strong> ${escapeHtml(param.resultProperty)}`;
        }
        
        refHtml += '</div>';
        return refHtml;
        
      default:
        return '';
    }
  }
  
  /**
   * Edit a parameter
   * @param {Object} param - The parameter to edit
   */
  function editParameter(param) {
    // Set the modal title and button text
    $("#newParameterModal .modal-title").text("Edit Parameter");
    $("#saveParameterBtn").text("Update Parameter");
    
    // Fill in the form fields
    $("#paramName").val(param.name).prop("disabled", true);
    $("#paramLabel").val(param.label || "");
    $("#paramType").val(param.type);
    $("#paramDescription").val(param.description || "");
    $("#paramRequired").prop("checked", param.required === true);
    $("#paramAdvanced").prop("checked", param.advanced === true);
    $("#paramGroupName").val(param.group || "");
    
    // Fill in type-specific fields
    switch (param.type) {
      case "number":
        $("#defaultValue").val(param.defaultValue !== undefined ? param.defaultValue : "");
        $("#paramUnit").val(param.unit || "");
        $("#minValue").val(param.min !== undefined ? param.min : "");
        $("#maxValue").val(param.max !== undefined ? param.max : "");
        $("#stepValue").val(param.step !== undefined ? param.step : "");
        $("#decimalDisplay").val(param.decimalPlaces !== undefined ? param.decimalPlaces : "2");
        break;
        
      case "text":
        $("#textDefaultValue").val(param.defaultValue || "");
        $("#placeholder").val(param.placeholder || "");
        $("#textPattern").val(param.pattern || "");
        break;
        
      case "boolean":
        $("#boolDefaultValue").prop("checked", param.defaultValue === true);
        $("#trueLabel").val(param.trueLabel || "Yes");
        $("#falseLabel").val(param.falseLabel || "No");
        break;
        
      case "select":
        $("#selectDefaultValue").val(param.defaultValue || "");
        
        // Fill in options
        $("#selectOptionsContainer").empty();
        if (param.options && param.options.length > 0) {
          param.options.forEach(option => {
            $("#selectOptionsContainer").append(`
              <div class="input-group mb-2 select-option">
                <input type="text" class="form-control option-value" placeholder="Value" value="${escapeHtml(option.value)}">
                <input type="text" class="form-control option-label" placeholder="Label" value="${escapeHtml(option.label || "")}">
                <div class="input-group-append">
                  <button class="btn btn-outline-danger remove-option-btn" type="button">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              </div>
            `);
          });
        } else {
          // Add an empty option row
          $("#selectOptionsContainer").append(`
            <div class="input-group mb-2 select-option">
              <input type="text" class="form-control option-value" placeholder="Value">
              <input type="text" class="form-control option-label" placeholder="Label">
              <div class="input-group-append">
                <button class="btn btn-outline-danger remove-option-btn" type="button">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            </div>
          `);
        }
        break;
        
      case "date":
        $("#dateDefaultValue").val(param.defaultValue || "");
        $("#minDate").val(param.min || "");
        $("#maxDate").val(param.max || "");
        break;
        
      case "calculation":
        // Load available calculations for reference parameter
        window.calculationsDB.calculations.getAll({ isPublic: true })
          .then(calculations => {
            $("#calcReference").empty().append('<option value="">Select a calculation</option>');
            
            calculations.forEach(calc => {
              // Don't include the current calculation
              if (_currentCalculation && calc.id === _currentCalculation.id) {
                return;
              }
              
              $("#calcReference").append(`
                <option value="${calc.id}" ${param.calcReference == calc.id ? 'selected' : ''}>
                  ${escapeHtml(calc.title)}
                </option>
              `);
            });
          })
          .catch(error => {
            console.error("Error loading public calculations:", error);
          });
        
        $("#resultProperty").val(param.resultProperty || "");
        break;
    }
    
    // Update parameter type UI
    updateParameterTypeUI();
    
    // Show the modal
    $("#newParameterModal").modal("show");
  }
  
  /**
   * Remove a parameter
   * @param {string} paramName - Name of the parameter to remove
   */
  function removeParameter(paramName) {
    if (confirm(`Are you sure you want to delete the parameter "${paramName}"?`)) {
      // Remove from the calculation parameters array
      if (_currentCalculation && _currentCalculation.parameters) {
        _currentCalculation.parameters = _currentCalculation.parameters.filter(p => p.name !== paramName);
      }
      
      // Remove from the UI
      $(`.parameter-item[data-param-name="${paramName}"]`).remove();
      
      // Show the no parameters message if there are no parameters left
      if ($("#parametersContainer .parameter-item").length === 0) {
        $("#noParametersMessage").show();
      }
    }
  }
  
  /**
   * Load calculation history
   * @param {string} period - Period for history (day, week, month, year)
   * @returns {Promise} Promise that resolves when history is loaded
   */
  function loadCalculationHistory(period = "day") {
    if (!_currentCalculation || !_currentCalculation.id) {
      return Promise.resolve();
    }
    
    // Only show history if storeHistory is enabled
    if (_currentCalculation.storeHistory === false) {
      $("#historyCard").hide();
      return Promise.resolve();
    }
    
  // Show the history card first to ensure the canvas has dimensions
  $("#historyCard").show();

    // Calculate date range for the selected period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case "day":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        break;
      case "week":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case "year":
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
    }
    
    return window.calculationsDB.history.get(_currentCalculation.id, {
      startDate: startDate,
      endDate: now
    })
      .then(history => {
        if (history.length === 0) {
          $("#historyCard").hide();
          return;
        }
        
        // Update history count
        $("#historyCount").text(history.length);
        
        // Show history card if showChart is enabled
        $("#historyCard").toggle(_currentCalculation.showChart === true);
        
        // Create history chart
        createHistoryChart(history, period);
      })
      .catch(error => {
        console.error("Error loading calculation history:", error);
        $("#historyCard").hide();
      });
  }
  
  /**
   * Create history chart
   * @param {Array} history - Array of history entries
   * @param {string} period - Period for history (day, week, month, year)
   */
  function createHistoryChart(history, period) {
    console.log("Creating history chart with", history.length, "entries");

    // Make sure the history card is visible before creating the chart
    $("#historyCard").show();
    
    const canvas = document.getElementById("historyChart");
    
    // Check if the canvas exists
    if (!canvas) {
      console.error("History chart canvas element not found");
      return;
    }
    
    // Destroy existing chart if it exists
    if (window.historyChartInstance) {
      window.historyChartInstance.destroy();
    }
  
    // Make sure we can get the 2D context
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Could not get 2D context from history chart canvas");
      return;
    }
    
    // Format timestamps based on the period
    const labels = history.map(entry => {
      const date = new Date(entry.timestamp);
      switch (period) {
        case "day":
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        case "week":
          return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        case "month":
          return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        case "year":
          return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
        default:
          return date.toLocaleTimeString();
      }
    });
    
    // Extract result values
    const resultValues = history.map(entry => {
      // Handle different result types
      if (typeof entry.result === "number") {
        return entry.result;
      } else if (typeof entry.result === "object" && entry.result !== null) {
        // For objects, we can't chart them directly
        // Just return a count of properties or array length
        return Array.isArray(entry.result) ? entry.result.length : Object.keys(entry.result).length;
      } else {
        return 0;
      }
    });
    
    // Create the chart
    window.historyChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Result',
          data: resultValues,
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: 'rgba(54, 162, 235, 1)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false,
            title: {
              display: true,
              text: _currentCalculation.resultUnit || 'Value'
            }
          },
          x: {
            title: {
              display: true,
              text: getTimePeriodLabel(period)
            }
          }
        }
      }
    });
  }
  
  /**
   * Get label for time period
   * @param {string} period - Period (day, week, month, year)
   * @returns {string} Label for the period
   */
  function getTimePeriodLabel(period) {
    switch (period) {
      case "day": return "Past 24 Hours";
      case "week": return "Past Week";
      case "month": return "Past Month";
      case "year": return "Past Year";
      default: return "Time";
    }
  }
  
  /**
   * Clear calculation history
   */
  function clearCalculationHistory() {
    if (!_currentCalculation || !_currentCalculation.id) {
      return;
    }
    
    if (confirm("Are you sure you want to clear the calculation history? This cannot be undone.")) {
      window.calculationsDB.history.clear(_currentCalculation.id)
        .then(() => {
          showNotification("Calculation history cleared", "success");
          $("#historyCard").hide();
        })
        .catch(error => {
          console.error("Error clearing calculation history:", error);
          showNotification("Error clearing history: " + error.message, "danger");
        });
    }
  }
  
  /**
   * Export calculation history
   */
  function exportCalculationHistory() {
    if (!_currentCalculation || !_currentCalculation.id) {
      return;
    }
    
    window.calculationsDB.history.get(_currentCalculation.id)
      .then(history => {
        if (history.length === 0) {
          showNotification("No history to export", "warning");
          return;
        }
        
        // Format history entries
        const formattedHistory = history.map(entry => {
          return {
            timestamp: new Date(entry.timestamp).toISOString(),
            result: entry.result,
            formattedResult: entry.formattedResult,
            parameters: entry.params
          };
        });
        
        // Create export data
        const exportData = {
          calculation: {
            id: _currentCalculation.id,
            title: _currentCalculation.title,
            description: _currentCalculation.description,
            type: _currentCalculation.type,
            resultUnit: _currentCalculation.resultUnit
          },
          history: formattedHistory,
          exportDate: new Date().toISOString()
        };
        
        // Convert to JSON and create download
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement("a");
        a.href = url;
        a.download = `${_currentCalculation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_history.json`;
        a.click();
        
        // Clean up
        URL.revokeObjectURL(url);
      })
      .catch(error => {
        console.error("Error exporting calculation history:", error);
        showNotification("Error exporting history: " + error.message, "danger");
      });
  }
  
  /**
   * Test the current calculation
   */
  function testCalculation() {
    // Validate the form fields
    const title = $("#calculationTitle").val().trim();
    if (!title) {
      showNotification("Title is required", "warning");
      return;
    }
    
    const type = $("#calculationType").val();
    
    // Prepare the test calculation object
    const testCalculation = {
      title: title,
      description: $("#calculationDesc").val().trim(),
      type: type,
      parameters: _currentCalculation.parameters || [],
      equation: $("#equationInput").val().trim(),
      resultFormat: $("#resultFormat").val(),
      decimalPlaces: parseInt($("#decimalPlaces").val()),
      numberFormat: $("#numberFormat").val(),
      resultUnit: $("#resultUnit").val().trim()
    };
    
    // Get code for custom calculations
    if (type === "custom-js") {
      testCalculation.customCode = _codeEditors.customJS.getValue();
      if (!testCalculation.customCode) {
        showNotification("Code is required for custom JavaScript calculations", "warning");
        return;
      }
      } else if (type === "custom-py") {
        testCalculation.customCode = _codeEditors.customPython ? _codeEditors.customPython.getValue() : "";
        if (!testCalculation.customCode) {
          showNotification("Code is required for custom Python calculations", "warning");
          return;
        }
      } else if (type === "standard" && !testCalculation.equation) {
        showNotification("Equation is required for standard calculations", "warning");
        return;
      }
      
      // Show test result container
      $("#testResultContainer").show();
      $("#testResultContainer").html(`
        <div class="alert alert-info">
          <i class="fas fa-spinner fa-spin"></i> Testing calculation...
        </div>
      `);
      
      // Create sample parameter values
      const testParams = {};
      if (testCalculation.parameters) {
        testCalculation.parameters.forEach(param => {
          // Skip calculation references for testing
          if (param.type === 'calculation') {
            return;
          }
          
          // Use default values if available
          if (param.defaultValue !== undefined) {
            testParams[param.name] = param.defaultValue;
          } else {
            // Generate sample values based on parameter type
            switch (param.type) {
              case 'number':
                if (param.min !== undefined && param.max !== undefined) {
                  testParams[param.name] = (param.min + param.max) / 2;
                } else if (param.min !== undefined) {
                  testParams[param.name] = param.min + 1;
                } else if (param.max !== undefined) {
                  testParams[param.name] = param.max - 1;
                } else {
                  testParams[param.name] = 10; // Default sample value
                }
                break;
                
              case 'text':
                testParams[param.name] = `Sample text for ${param.name}`;
                break;
                
              case 'boolean':
                testParams[param.name] = true;
                break;
                
              case 'select':
                if (param.options && param.options.length > 0) {
                  testParams[param.name] = param.options[0].value;
                }
                break;
                
              case 'date':
                testParams[param.name] = new Date();
                break;
            }
          }
        });
      }
      
      // Execute the test calculation
      window.calculationsEngine.executeCalculation(testCalculation, testParams, { saveHistory: false, detailed: true })
        .then(result => {
          // Display the test result
          let testResultHtml = `
            <div class="card">
              <div class="card-header bg-success text-white">
                <i class="fas fa-check-circle"></i> Test successful
              </div>
              <div class="card-body">
                <h6>Result:</h6>
                <div class="bg-light p-3 border rounded">
                  ${formatTestResult(result)}
                </div>
              `;
          
          // Add parameter values used for testing
          if (Object.keys(testParams).length > 0) {
            testResultHtml += `
              <h6 class="mt-3">Test Parameters:</h6>
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
            `;
            
            Object.entries(testParams).forEach(([name, value]) => {
              testResultHtml += `
                <tr>
                  <td>${escapeHtml(name)}</td>
                  <td>${formatTestParameterValue(value)}</td>
                </tr>
              `;
            });
            
            testResultHtml += `
                </tbody>
              </table>
            `;
          }
          
          testResultHtml += `
              </div>
            </div>
          `;
          
          $("#testResultContainer").html(testResultHtml);
        })
        .catch(error => {
          // Display the error
          $("#testResultContainer").html(`
            <div class="card">
              <div class="card-header bg-danger text-white">
                <i class="fas fa-exclamation-circle"></i> Test failed
              </div>
              <div class="card-body">
                <h6>Error:</h6>
                <div class="alert alert-danger">
                  ${escapeHtml(error.message)}
                </div>
                
                <div class="mt-3">
                  <button class="btn btn-sm btn-outline-info" id="aiFixBtn">
                    <i class="fas fa-robot"></i> AI Assistance with Error
                  </button>
                </div>
              </div>
            </div>
          `);
          
          // Set up AI fix button
          $("#aiFixBtn").on("click", function() {
            getAIErrorAssistance(error.message, testCalculation);
          });
        });
    }
    
    /**
     * Format test result for display
     * @param {Object} result - The test result data
     * @returns {string} Formatted result HTML
     */
    function formatTestResult(result) {
      if (typeof result.formattedResult === 'object' && result.formattedResult !== null) {
        return `<pre>${escapeHtml(JSON.stringify(result.formattedResult, null, 2))}</pre>`;
      } else {
        return `<span class="result-value">${escapeHtml(String(result.formattedResult))}</span>`;
      }
    }
    
    /**
     * Format test parameter value for display
     * @param {*} value - The parameter value
     * @returns {string} Formatted value
     */
    function formatTestParameterValue(value) {
      if (value === null || value === undefined) {
        return '<em>null</em>';
      } else if (typeof value === 'object') {
        if (value instanceof Date) {
          return value.toLocaleString();
        } else {
          return escapeHtml(JSON.stringify(value));
        }
      } else {
        return escapeHtml(String(value));
      }
    }
    
    /**
     * Update the current calculation from another source
     * @param {Object} updatedCalculation - The updated calculation
     */
    function updateCurrentCalculation(updatedCalculation) {
      if (!_currentCalculation || !updatedCalculation) {
        return;
      }
      
      // Update properties
      Object.assign(_currentCalculation, updatedCalculation);
      
      // Update form fields
      $("#calculationTitle").val(_currentCalculation.title || "");
      $("#calculationDesc").val(_currentCalculation.description || "");
      $("#calculationType").val(_currentCalculation.type || "standard");
      $("#calculationTags").val(_currentCalculation.tags ? _currentCalculation.tags.join(", ") : "");
      $("#isPublic").prop("checked", _currentCalculation.isPublic === true);
      $("#equationInput").val(_currentCalculation.equation || "");
      $("#resultFormat").val(_currentCalculation.resultFormat || "auto");
      $("#decimalPlaces").val(_currentCalculation.decimalPlaces !== undefined ? _currentCalculation.decimalPlaces : (_settings.defaultDecimalPlaces || 2));
      $("#numberFormat").val(_currentCalculation.numberFormat || (_settings.defaultNumberFormat || "decimal"));
      $("#resultUnit").val(_currentCalculation.resultUnit || "");
      $("#resultPrefix").val(_currentCalculation.resultPrefix || "");
      $("#resultSuffix").val(_currentCalculation.resultSuffix || "");
      $("#storeHistory").prop("checked", _currentCalculation.storeHistory !== false);
      $("#showChart").prop("checked", _currentCalculation.showChart === true);
      
      // Update code editors
      if (_currentCalculation.customCode) {
        if (_currentCalculation.type === "custom-js") {
          _codeEditors.customJS.setValue(_currentCalculation.customCode);
        } else if (_currentCalculation.type === "custom-py" && _codeEditors.customPython) {
          _codeEditors.customPython.setValue(_currentCalculation.customCode);
        }
      }
      
      // Update parameters
      $("#parametersContainer").empty();
      $("#noParametersMessage").toggle(!_currentCalculation.parameters || _currentCalculation.parameters.length === 0);
      
      if (_currentCalculation.parameters && _currentCalculation.parameters.length > 0) {
        _currentCalculation.parameters.forEach(param => {
          renderParameter(param);
        });
      }
      
      // Update the form UI
      updateCalculationTypeUI();
      
      // Analyze dependencies
      analyzeDependencies();
    }
    
    /**
     * Get AI assistance for code
     */
    function getAICodeAssistance() {
      const type = $("#calculationType").val();
      let code = "";
      let language = "";
      
      switch (type) {
        case "standard":
          code = $("#equationInput").val().trim();
          language = "standard equation";
          break;
        case "custom-js":
          code = _codeEditors.customJS.getValue();
          language = "JavaScript";
          break;
        case "custom-py":
          code = _codeEditors.customPython ? _codeEditors.customPython.getValue() : "";
          language = "Python";
          break;
      }
      
      if (!code) {
        showNotification("Please enter some code to get assistance", "warning");
        return;
      }
      
      // Get parameter information
      const parameters = _currentCalculation.parameters || [];
      const parameterInfo = parameters.map(param => {
        return {
          name: param.name,
          type: param.type,
          description: param.description || "",
          unit: param.unit || ""
        };
      });
      
      // Show thinking indicator
      $("#aiThinkingLogic").show();
      $("#aiSuggestion").hide();
      $("#aiSuggestionContainer").show();
      
      // Call OpenAI API for assistance
      getAIAssistance({
        type: "code_help",
        language: language,
        code: code,
        parameters: parameterInfo,
        task: "Analyze and optimize this calculation code. Provide suggestions for improvement, error handling, or optimization."
      })
        .then(response => {
          // Hide thinking indicator and show suggestion
          $("#aiThinkingLogic").hide();
          $("#aiSuggestion").html(response).show();
        })
        .catch(error => {
          $("#aiThinkingLogic").hide();
          $("#aiSuggestion").html(`
            <div class="alert alert-danger">
              <strong>Error:</strong> ${error.message || "Failed to get AI assistance"}
            </div>
          `).show();
        });
    }
    
    /**
     * Get AI assistance for error
     * @param {string} errorMessage - The error message
     * @param {Object} calculation - The calculation that generated the error
     */
    function getAIErrorAssistance(errorMessage, calculation) {
      // Get the code based on calculation type
      let code = "";
      let language = "";
      
      switch (calculation.type) {
        case "standard":
          code = calculation.equation;
          language = "standard equation";
          break;
        case "custom-js":
          code = calculation.customCode;
          language = "JavaScript";
          break;
        case "custom-py":
          code = calculation.customCode;
          language = "Python";
          break;
      }
      
      if (!code) {
        showNotification("No code available to analyze", "warning");
        return;
      }
      
      // Create a simplified parameter list
      const parameters = calculation.parameters || [];
      const parameterInfo = parameters.map(param => {
        return {
          name: param.name,
          type: param.type,
          description: param.description || "",
          unit: param.unit || ""
        };
      });
      
      // Show thinking indicator
      $("#aiFixBtn").prop("disabled", true).html('<i class="fas fa-spinner fa-spin"></i> Analyzing error...');
      
      // Call OpenAI API for assistance
      getAIAssistance({
        type: "error_analysis",
        language: language,
        code: code,
        error: errorMessage,
        parameters: parameterInfo,
        task: "Analyze this error and provide a solution to fix it."
      })
        .then(response => {
          // Add the response to the test results
          $("#testResultContainer").append(`
            <div class="card mt-3">
              <div class="card-header bg-info text-white">
                <i class="fas fa-robot"></i> AI Error Analysis
              </div>
              <div class="card-body">
                ${response}
              </div>
            </div>
          `);
          
          // Reset the button
          $("#aiFixBtn").prop("disabled", false).html('<i class="fas fa-robot"></i> AI Assistance with Error');
        })
        .catch(error => {
          // Reset the button
          $("#aiFixBtn").prop("disabled", false).html('<i class="fas fa-robot"></i> AI Assistance with Error');
          
          showNotification("Error getting AI assistance: " + error.message, "danger");
        });
    }
    
    /**
     * Request AI to suggest parameters based on calculation
     */
    function suggestParameters() {
      const type = $("#calculationType").val();
      let code = "";
      let language = "";
      
      switch (type) {
        case "standard":
          code = $("#equationInput").val().trim();
          language = "standard equation";
          break;
        case "custom-js":
          code = _codeEditors.customJS.getValue();
          language = "JavaScript";
          break;
        case "custom-py":
          code = _codeEditors.customPython ? _codeEditors.customPython.getValue() : "";
          language = "Python";
          break;
      }
      
      if (!code) {
        showNotification("Please enter some code or equation first", "warning");
        return;
      }
      
      // Show thinking indicator
      $("#aiThinking").show();
      $("#aiSuggestions").hide();
      $("#aiParamSuggestions").show();
      
      // Call OpenAI API for suggestions
      getAIAssistance({
        type: "parameter_suggestions",
        language: language,
        code: code,
        title: $("#calculationTitle").val().trim(),
        description: $("#calculationDesc").val().trim(),
        task: "Analyze this calculation and suggest appropriate parameters."
      })
        .then(response => {
          // Hide thinking indicator and show suggestions
          $("#aiThinking").hide();
          $("#aiSuggestions").html(response).show();
          
          // Add an "Apply Suggestions" button if suggestions are provided
          $("#aiSuggestions").append(`
            <div class="mt-3">
              <button class="btn btn-sm btn-outline-primary" id="applyAiParamsBtn">
                <i class="fas fa-check"></i> Apply Suggested Parameters
              </button>
              <button class="btn btn-sm btn-outline-secondary ml-2" id="dismissAiParamsBtn">
                <i class="fas fa-times"></i> Dismiss
              </button>
            </div>
          `);
          
          // Set up buttons
          $("#applyAiParamsBtn").on("click", applyAIParameterSuggestions);
          $("#dismissAiParamsBtn").on("click", function() {
            $("#aiParamSuggestions").hide();
          });
        })
        .catch(error => {
          $("#aiThinking").hide();
          $("#aiSuggestions").html(`
            <div class="alert alert-danger">
              <strong>Error:</strong> ${error.message || "Failed to get parameter suggestions"}
            </div>
            <button class="btn btn-sm btn-outline-secondary" id="dismissAiParamsBtn">
              <i class="fas fa-times"></i> Dismiss
            </button>
          `).show();
          
          $("#dismissAiParamsBtn").on("click", function() {
            $("#aiParamSuggestions").hide();
          });
        });
    }
    
    /**
     * Apply AI parameter suggestions
     * This function parses the AI response and adds suggested parameters
     */
    function applyAIParameterSuggestions() {
      const suggestionText = $("#aiSuggestions").text();
      
      // Regular expression pattern to find parameter definitions
      const paramPattern = /Parameter: ([a-zA-Z0-9_]+)\s*Type: ([a-zA-Z]+)\s*(?:Default: ([^]+?))?(?:Description: ([^]+?))?(?=Parameter:|$)/g;
      
      let match;
      let addedCount = 0;
      
      // Process each matched parameter
      while ((match = paramPattern.exec(suggestionText)) !== null) {
        const name = match[1].trim();
        const type = match[2].trim().toLowerCase();
        const defaultValue = match[3] ? match[3].trim() : undefined;
        const description = match[4] ? match[4].trim() : undefined;
        
        // Skip if parameter already exists
        if (_currentCalculation.parameters && _currentCalculation.parameters.some(p => p.name === name)) {
          continue;
        }
        
        // Create parameter object
        const param = {
          name: name,
          label: name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1').trim(),
          type: mapAITypeToParameterType(type),
          description: description,
          required: false,
          advanced: false
        };
        
        // Set default value based on type
        if (defaultValue !== undefined) {
          switch (param.type) {
            case "number":
              param.defaultValue = parseFloat(defaultValue) || 0;
              break;
            case "boolean":
              param.defaultValue = defaultValue.toLowerCase() === "true";
              break;
            default:
              param.defaultValue = defaultValue;
          }
        }
        
        // Add parameter to calculation
        if (!_currentCalculation.parameters) {
          _currentCalculation.parameters = [];
        }
        
        _currentCalculation.parameters.push(param);
        
        // Render the parameter in UI
        renderParameter(param);
        
        addedCount++;
      }
      
      // Hide the suggestions
      $("#aiParamSuggestions").hide();
      
      // Hide "no parameters" message if parameters were added
      if (addedCount > 0) {
        $("#noParametersMessage").hide();
        showNotification(`Added ${addedCount} parameters`, "success");
      } else {
        showNotification("No new parameters were found to add", "info");
      }
    }
    
    /**
     * Map AI parameter type to our parameter types
     * @param {string} aiType - The parameter type from AI
     * @returns {string} Our parameter type
     */
    function mapAITypeToParameterType(aiType) {
      const type = aiType.toLowerCase();
      
      if (type.includes("number") || type.includes("int") || type.includes("float") || type.includes("double")) {
        return "number";
      } else if (type.includes("string") || type.includes("text")) {
        return "text";
      } else if (type.includes("bool")) {
        return "boolean";
      } else if (type.includes("select") || type.includes("option") || type.includes("enum")) {
        return "select";
      } else if (type.includes("date")) {
        return "date";
      } else {
        return "text"; // Default to text
      }
    }
    
    /**
     * Get AI assistance with OpenAI API
     * @param {Object} data - Data for the request
     * @returns {Promise<string>} Promise that resolves with the AI response
     */
    function getAIAssistance(data) {
      return new Promise((resolve, reject) => {
        // Get OpenAI settings
        window.calculationsDB.settings.get("openAISettings")
          .then(settings => {
            if (!settings || !settings.apiKey) {
              throw new Error("OpenAI API key not configured. Please add it in Settings.");
            }
            
            const apiKey = settings.apiKey;
            const model = settings.model || "gpt-3.5-turbo";
            
            // Construct the API request
            let prompt = "";
            
            switch (data.type) {
              case "code_help":
                prompt = `You are a helpful assistant for a calculation system. Please analyze this ${data.language} code and provide suggestions for improvement, error handling, or optimization:
                
  ${data.code}
  
  Parameters available:
  ${data.parameters.map(p => `- ${p.name}: ${p.type}${p.description ? ` (${p.description})` : ''}${p.unit ? ` [${p.unit}]` : ''}`).join('\n')}
  
  ${data.task}
  
  Format your response with markdown including clear sections for:
  1. Code Analysis
  2. Suggestions
  3. Improved Code Example (if applicable)
  `;
                break;
                
              case "error_analysis":
                prompt = `You are a helpful assistant for a calculation system. A calculation has generated the following error:
  
  ERROR: ${data.error}
  
  The ${data.language} code is:
  ${data.code}
  
  Parameters available:
  ${data.parameters.map(p => `- ${p.name}: ${p.type}${p.description ? ` (${p.description})` : ''}${p.unit ? ` [${p.unit}]` : ''}`).join('\n')}
  
  ${data.task}
  
  Format your response with markdown including:
  1. Error Analysis
  2. Solution
  3. Fixed Code Example
  `;
                break;
                
              case "parameter_suggestions":
                prompt = `You are a helpful assistant for a calculation system. Please analyze this ${data.language} code and suggest appropriate parameters:
  
  Calculation Title: ${data.title || "Untitled Calculation"}
  Description: ${data.description || "No description provided"}
  
  Code:
  ${data.code}
  
  ${data.task}
  
  For each parameter, provide the following information in this exact format:
  Parameter: [parameter_name]
  Type: [number/text/boolean/select/date]
  Default: [default value if applicable]
  Description: [brief description of the parameter]
  
  Do not include any other text outside of these parameter definitions. Focus on identifying variables that would be inputs to this calculation.
  `;
                break;
            }
            
            // Call OpenAI API
            fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                model: model,
                messages: [
                  { role: "system", content: "You are a helpful assistant for a calculation system." },
                  { role: "user", content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 2000
              })
            })
              .then(response => {
                if (!response.ok) {
                  return response.json().then(data => {
                    throw new Error(data.error?.message || "API request failed");
                  });
                }
                return response.json();
              })
              .then(data => {
                const response = data.choices[0].message.content;
                resolve(response);
              })
              .catch(error => {
                console.error("OpenAI API error:", error);
                reject(error);
              });
          })
          .catch(error => {
            console.error("Error getting OpenAI settings:", error);
            reject(error);
          });
      });
    }
    
    /**
     * Edit the current calculation in the execution view
     */
    function editCurrentCalculation() {
      if (!_currentCalculation || !_currentCalculation.id) {
        return;
      }
      
      loadCalculationEdit(_currentCalculation.id);
    }
    
    /**
     * Refresh the current calculation in the execution view
     */
    function refreshCalculation() {
      if (!_currentCalculation || !_currentCalculation.id) {
        return;
      }
      
      executeCalculation();
    }
    
    /**
     * Recalculate with updated dependencies
     */
    function recalculateDependencies() {
      if (!_currentCalculation || !_currentCalculation.id) {
        return;
      }
      
      // Clear cache for this calculation
      window.calculationsEngine.clearCalculationCache(_currentCalculation.id);
      
      // Execute calculation
      executeCalculation();
    }
    
    /**
     * Copy result to clipboard
     */
    function copyResultToClipboard() {
      const result = $("#resultValue").text();
      const unit = $("#resultUnitDisplay").text();
      const prefix = $("#resultPrefix").text();
      const suffix = $("#resultSuffix").text();
      
      // Construct full result
      const fullResult = `${prefix} ${result} ${unit} ${suffix}`.trim();
      
      // Create a temporary textarea to copy from
      const textarea = document.createElement("textarea");
      textarea.value = fullResult;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      
      showNotification("Result copied to clipboard", "success");
    }
    
    /**
     * Export calculation result
     */
    function exportCalculationResult() {
      if (!_currentCalculation || !_currentCalculation.id) {
        return;
      }
      
      // Get the current result
      const cachedResult = window.calculationsEngine.getCachedResult(_currentCalculation.id);
      if (!cachedResult) {
        showNotification("No result to export", "warning");
        return;
      }
      
      // Get parameter values
      const paramValues = getParameterValues();
      
      // Create export data
      const exportData = {
        calculation: {
          id: _currentCalculation.id,
          title: _currentCalculation.title,
          description: _currentCalculation.description,
          type: _currentCalculation.type,
          resultUnit: _currentCalculation.resultUnit
        },
        result: cachedResult.result,
        formattedResult: cachedResult.formattedResult,
        parameters: paramValues,
        timestamp: new Date().toISOString()
      };
      
      // Convert to JSON and create download
      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `${_currentCalculation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_result.json`;
      a.click();
      
      // Clean up
      URL.revokeObjectURL(url);
    }
    
    /**
     * Share a calculation
     */
    function shareCalculation() {
      if (!_currentCalculation || !_currentCalculation.id) {
        return;
      }
      
      // Export the calculation
      window.calculationsDB.export({
        includeCalculations: true,
        includeFunctions: false,
        includeSettings: false,
        includeHistory: false
      })
        .then(exportData => {
          // Filter to include only the current calculation
          exportData.calculations = exportData.calculations.filter(calc => calc.id === _currentCalculation.id);
          
          if (exportData.calculations.length === 0) {
            throw new Error("Calculation not found in export data");
          }
          
          // Convert to JSON and create download
          const json = JSON.stringify(exportData, null, 2);
          const blob = new Blob([json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement("a");
          a.href = url;
          a.download = `${_currentCalculation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_shared.json`;
          a.click();
          
          // Clean up
          URL.revokeObjectURL(url);
          
          showNotification("Calculation exported for sharing", "success");
        })
        .catch(error => {
          console.error("Error sharing calculation:", error);
          showNotification("Error sharing calculation: " + error.message, "danger");
        });
    }
    
    /**********************
     * Functions Management
     **********************/
    
    /**
     * Load functions list with optional search filter
     * @param {string} searchTerm - Optional search term to filter functions
     */
    function loadFunctions(searchTerm = "") {
      window.calculationsDB.functions.getAll({ searchTerm })
        .then(functions => {
          const listContainer = $("#functionList");
          listContainer.empty();
          
          if (functions.length === 0) {
            $("#noFunctionsMessage").show();
            return;
          } else {
            $("#noFunctionsMessage").hide();
          }
          
          functions.forEach(func => {
            const listItem = $(`
              <li class="list-group-item function-item" data-name="${func.name}">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <code class="function-name">${escapeHtml(func.name)}(${func.params.join(", ")})</code>
                    <div class="small text-muted">${escapeHtml(func.description || "")}</div>
                  </div>
                  <div class="btn-group">
                    <button class="btn btn-sm btn-outline-secondary edit-function-btn">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-function-btn">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
                ${func.tags && func.tags.length ? 
                  `<div class="mt-1">
                    ${func.tags.map(tag => 
                      `<span class="badge badge-secondary mr-1">${escapeHtml(tag)}</span>`
                    ).join('')}
                  </div>` : 
                  ''}
              </li>
            `);
            
            // Set up event handlers
            listItem.on("click", function() {
              loadFunctionEdit(func.name);
            });
            
            listItem.find(".edit-function-btn").on("click", function(e) {
              e.stopPropagation();
              loadFunctionEdit(func.name);
            });
            
            listItem.find(".delete-function-btn").on("click", function(e) {
              e.stopPropagation();
              deleteFunction(func.name);
            });
            
            listContainer.append(listItem);
          });
        })
        .catch(error => {
          console.error("Error loading functions:", error);
          showNotification("Error loading functions: " + error.message, "danger");
        });
    }
    
    /**
     * Create a new function
     */
    function newFunction() {
      _currentFunction = {
        name: "",
        description: "",
        params: [],
        code: "// Your function code here\nreturn result;",
        isGlobal: true,
        tags: []
      };
      
      showFunctionEditForm();
    }
    
    /**
     * Show function edit form
     */
    function showFunctionEditForm()
    {
      // Hide empty state and show form
      $("#emptyFunctionState").hide();
      $("#functionForm").show();
      
      // Show correct buttons
      if (_currentFunction.name && !$("#functionName").prop("disabled")) {
        $("#deleteFunctionBtn").show();
        $("#functionName").prop("disabled", true);
      } else {
        $("#deleteFunctionBtn").hide();
        $("#functionName").prop("disabled", false);
      }
      
      // Set form title
      $("#functionForm button[type=submit]").text(_currentFunction.name ? "Update Function" : "Save Function");
      
      // Fill form fields
      $("#functionName").val(_currentFunction.name || "");
      $("#functionDesc").val(_currentFunction.description || "");
      $("#functionParams").val(_currentFunction.params ? _currentFunction.params.join(", ") : "");
      $("#functionTags").val(_currentFunction.tags ? _currentFunction.tags.join(", ") : "");
      $("#functionGlobal").prop("checked", _currentFunction.isGlobal !== false);
      
      // Update function signature
      updateFunctionSignature();
      
      // Set code editor content
      _codeEditors.function.setValue(_currentFunction.code || "// Your function code here\nreturn result;");
      _codeEditors.function.refresh();
      
      // Hide test area
      $("#functionTestArea").hide();
    }
    
    /**
     * Load a function for editing
     * @param {string} functionName - Name of the function to edit
     */
    function loadFunctionEdit(functionName) {
      window.calculationsDB.functions.get(functionName)
        .then(func => {
          if (!func) {
            throw new Error("Function not found");
          }
          
          _currentFunction = func;
          showFunctionEditForm();
        })
        .catch(error => {
          console.error("Error loading function:", error);
          showNotification("Error loading function: " + error.message, "danger");
        });
    }
    
    /**
     * Update function signature preview
     */
    function updateFunctionSignature() {
      const name = $("#functionName").val().trim() || "myFunction";
      const params = $("#functionParams").val().trim() ?
        $("#functionParams").val().trim().split(",").map(p => p.trim()) :
        [];
      
      $("#functionSignature").text(`function ${name}(${params.join(", ")}) { ... }`);
    }
    
    /**
     * Save the current function
     * @param {Event} event - Form submit event
     */
    function saveFunctionForm(event) {
      event.preventDefault();
      
      // Get form values
      const name = $("#functionName").val().trim();
      if (!name) {
        showNotification("Function name is required", "warning");
        return;
      }
      
      const description = $("#functionDesc").val().trim();
      const paramsStr = $("#functionParams").val().trim();
      const params = paramsStr ? paramsStr.split(",").map(p => p.trim()) : [];
      const tagsStr = $("#functionTags").val().trim();
      const tags = tagsStr ? tagsStr.split(",").map(t => t.trim()) : [];
      const isGlobal = $("#functionGlobal").prop("checked");
      
      // Get code
      const code = _codeEditors.function.getValue().trim();
      if (!code) {
        showNotification("Function code is required", "warning");
        return;
      }
      
      // Update the current function
      _currentFunction.name = name;
      _currentFunction.description = description;
      _currentFunction.params = params;
      _currentFunction.tags = tags;
      _currentFunction.isGlobal = isGlobal;
      _currentFunction.code = code;
      
      // Save to database
      window.calculationsDB.functions.save(_currentFunction)
        .then(() => {
          showNotification(`Function "${name}" saved successfully`, "success");
          
          // Register function with calculation engine if global
          if (isGlobal) {
            window.calculationsEngine.registerFunction(_currentFunction);
          } else {
            window.calculationsEngine.unregisterFunction(name);
          }
          
          // Reload the functions list
          loadFunctions();
          
          // Keep editing the function
          $("#functionName").prop("disabled", true);
          $("#deleteFunctionBtn").show();
          
          // Show test area
          $("#functionTestArea").show();
          
          // Check if we need to reload test parameters
          renderFunctionTestParams();
        })
        .catch(error => {
          console.error("Error saving function:", error);
          showNotification("Error saving function: " + error.message, "danger");
        });
    }
    
    /**
     * Cancel editing the current function
     */
    function cancelFunctionEdit() {
      _currentFunction = null;
      $("#functionForm").hide();
      $("#functionTestArea").hide();
      $("#emptyFunctionState").show();
    }
    
    /**
     * Delete a function
     * @param {string} functionName - Name of the function to delete
     */
    function deleteFunction(functionName) {
      if (confirm(`Are you sure you want to delete the function "${functionName}"?`)) {
        window.calculationsDB.functions.delete(functionName)
          .then(() => {
            showNotification(`Function "${functionName}" deleted`, "success");
            
            // Unregister function from calculation engine
            window.calculationsEngine.unregisterFunction(functionName);
            
            // Clear current function if it's the one being deleted
            if (_currentFunction && _currentFunction.name === functionName) {
              _currentFunction = null;
              $("#functionForm").hide();
              $("#functionTestArea").hide();
              $("#emptyFunctionState").show();
            }
            
            // Reload the functions list
            loadFunctions();
          })
          .catch(error => {
            console.error("Error deleting function:", error);
            showNotification("Error deleting function: " + error.message, "danger");
          });
      }
    }
    
    /**
     * Delete the current function being edited
     */
    function deleteCurrentFunction() {
      if (!_currentFunction || !_currentFunction.name) {
        return;
      }
      
      deleteFunction(_currentFunction.name);
    }
    
    /**
     * Test the current function
     */
    function testCurrentFunction() {
      if (!_currentFunction || !_currentFunction.name) {
        showNotification("Save the function before testing", "warning");
        return;
      }
      
      // Show test area
      $("#functionTestArea").show();
      
      // Render test parameters
      renderFunctionTestParams();
    }
    
    /**
     * Render function test parameters
     */
    function renderFunctionTestParams() {
      if (!_currentFunction || !_currentFunction.params.length === 0) {
        $("#testParamsContainer").html('<p class="text-muted">No parameters to test</p>');
        return;
      }
      
      let paramHtml = "";
      
      _currentFunction.params.forEach(param => {
        paramHtml += `
          <div class="form-group">
            <label for="test-${param}">${param}</label>
            <input type="text" class="form-control test-param" id="test-${param}" data-param="${param}" placeholder="Enter test value">
          </div>
        `;
      });
      
      $("#testParamsContainer").html(paramHtml);
      
      // Add event handler for the Run Test button
      $("#runFunctionTestBtn").off("click").on("click", function() {
        runFunctionTest();
      });
    }
    
    /**
     * Run a function test
     */
    function runFunctionTest() {
      // Get parameter values
      const testParams = {};
      
      $(".test-param").each(function() {
        const param = $(this).data("param");
        const value = $(this).val();
        
        // Try to detect the value type
        let parsedValue;
        
        if (value === "true" || value === "false") {
          parsedValue = value === "true";
        } else if (!isNaN(value) && value !== "") {
          parsedValue = Number(value);
        } else if (value.startsWith("[") || value.startsWith("{")) {
          try {
            parsedValue = JSON.parse(value);
          } catch (e) {
            parsedValue = value;
          }
        } else {
          parsedValue = value;
        }
        
        testParams[param] = parsedValue;
      });
      
      // Execute the function
      window.calculationsEngine.testFunction(_currentFunction, testParams)
        .then(result => {
          // Show the result
          $("#functionTestResult").show();
          $("#functionTestError").hide();
          
          // Format the result
          let formattedResult;
          if (typeof result === "object" && result !== null) {
            formattedResult = `<pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>`;
          } else if (typeof result === "undefined") {
            formattedResult = "<em>undefined</em>";
          } else {
            formattedResult = escapeHtml(String(result));
          }
          
          $("#testResultValue").html(formattedResult);
        })
        .catch(error => {
          // Show the error
          $("#functionTestResult").hide();
          $("#functionTestError").show();
          $("#testErrorMessage").text(error.message);
        });
    }
    
    /**
     * Show all built-in functions
     */
    function showAllBuiltinFunctions() {
      // Replace the button with all built-in functions
      const mathFunctions = [
        { name: "sin", desc: "Sine of angle in radians" },
        { name: "cos", desc: "Cosine of angle in radians" },
        { name: "tan", desc: "Tangent of angle in radians" },
        { name: "asin", desc: "Arcsine in radians" },
        { name: "acos", desc: "Arccosine in radians" },
        { name: "atan", desc: "Arctangent in radians" },
        { name: "sinh", desc: "Hyperbolic sine" },
        { name: "cosh", desc: "Hyperbolic cosine" },
        { name: "tanh", desc: "Hyperbolic tangent" },
        { name: "log", desc: "Natural logarithm" },
        { name: "log10", desc: "Base-10 logarithm" },
        { name: "log2", desc: "Base-2 logarithm" },
        { name: "exp", desc: "e raised to power" },
        { name: "ceil", desc: "Round up to nearest integer" },
        { name: "floor", desc: "Round down to nearest integer" },
        { name: "round", desc: "Round to nearest integer" },
        { name: "sign", desc: "Sign of value (-1, 0, 1)" },
        { name: "random", desc: "Random number between 0 and 1" },
        { name: "factorial", desc: "Factorial of number" },
        { name: "gamma", desc: "Gamma function" },
        { name: "max", desc: "Maximum value from list" },
        { name: "min", desc: "Minimum value from list" },
        { name: "mean", desc: "Mean/average of values" },
        { name: "median", desc: "Median of values" },
        { name: "std", desc: "Standard deviation" },
        { name: "variance", desc: "Variance of values" },
        { name: "hypot", desc: "Hypotenuse sqrt(x*x + y*y)" },
        { name: "nthRoot", desc: "nth root of a value" },
        { name: "distance", desc: "Distance between points" },
        { name: "mod", desc: "Modulus, remainder after division" }
      ];
      
      // Replace the button with the function list
      let html = '';
      
      mathFunctions.forEach(func => {
        html += `
          <a href="#" class="list-group-item list-group-item-action" data-name="${func.name}">
            <span class="function-name">${func.name}()</span>
            <small class="d-block text-muted">${func.desc}</small>
          </a>
        `;
      });
      
      // Replace the button with the expanded list
      $("#showMoreFunctionsBtn").replaceWith(html);
      
      // Add event handler for function clicks
      $("#builtinFunctionList .list-group-item").on("click", function(e) {
        e.preventDefault();
        showFunctionDocumentation($(this).data("name"));
      });
    }
    
    /**
     * Show documentation for a built-in function
     * @param {string} functionName - Name of the function to show docs for
     */
    function showFunctionDocumentation(functionName) {
      // Get function documentation from math.js
      const docs = math.help(functionName);
      
      if (!docs) {
        showNotification(`Documentation not available for ${functionName}`, "warning");
        return;
      }
      
      // Format the documentation
      let docHtml = `
        <h4>${docs.name}</h4>
        <p>${docs.description}</p>
      `;
      
      if (docs.syntax) {
        docHtml += `
          <h5>Syntax</h5>
          <pre>${escapeHtml(docs.syntax.join("\n"))}</pre>
        `;
      }
      
      if (docs.examples) {
        docHtml += `
          <h5>Examples</h5>
          <pre>${escapeHtml(docs.examples.join("\n"))}</pre>
        `;
      }
      
      if (docs.seealso) {
        docHtml += `
          <h5>See Also</h5>
          <p>${docs.seealso.join(", ")}</p>
        `;
      }
      
      // Set up the modal
      $("#functionDocTitle").text(`${functionName}() Documentation`);
      $("#functionDocContent").html(docHtml);
      
      // Show the modal
      $("#functionDocModal").modal("show");
    }
    
    /**********************
     * Variables Management
     **********************/
    
    /**
     * Load the variable browser
     * @param {string} searchTerm - Optional search term to filter variables
     * @param {string} filterType - Optional filter by variable type
     * @param {boolean} isModal - Whether this is being loaded in the modal or main view
     */
    function loadVariableBrowser(searchTerm = "", filterType = "all", isModal = false) {
      const variableBrowser = isModal ? $("#modalVariableBrowser") : $("#variableBrowser");
      variableBrowser.empty();
      
      // Create the root tree
      const rootTree = $('<ul class="variable-tree variable-tree-root"></ul>');
      variableBrowser.append(rootTree);
      
      // Load variables from different sources
      Promise.all([
        loadParameterVariables(searchTerm, filterType),
        loadCalculationVariables(searchTerm, filterType),
        loadFunctionVariables(searchTerm, filterType)
      ])
        .then(([parameters, calculations, functions]) => {
          const hasParameters = parameters.length > 0;
          const hasCalculations = calculations.length > 0;
          const hasFunctions = functions.length > 0;
          
          // If no variables found, show message
          if (!hasParameters && !hasCalculations && !hasFunctions) {
            rootTree.html(`
              <li class="text-muted text-center py-3">
                ${searchTerm ? `No variables found for "${escapeHtml(searchTerm)}"` : 'No variables available'}
              </li>
            `);
            return;
          }
          
          // Add parameters
          if (hasParameters && (filterType === "all" || filterType === "parameter")) {
            const parameterNode = $(`
              <li>
                <div class="variable-item">
                  <i class="fas fa-list icon"></i>
                  <strong>Parameters</strong>
                </div>
                <ul class="variable-tree"></ul>
              </li>
            `);
            
            const parameterList = parameterNode.find("ul");
            
            parameters.forEach(param => {
              const paramItem = $(`
                <li>
                  <div class="variable-item" data-type="parameter" data-name="${param.name}">
                    <i class="fas fa-cube icon param-icon"></i>
                    ${escapeHtml(param.name)}
                    <span class="badge badge-info ml-1">${getParameterTypeLabel(param.type)}</span>
                  </div>
                </li>
              `);
              
              paramItem.find(".variable-item").on("click", function() {
                showVariableDetails("parameter", param.name);
              });
              
              parameterList.append(paramItem);
            });
            
            rootTree.append(parameterNode);
          }
          
          // Add calculations
          if (hasCalculations && (filterType === "all" || filterType === "calculation")) {
            const calculationNode = $(`
              <li>
                <div class="variable-item">
                  <i class="fas fa-calculator icon"></i>
                  <strong>Calculations</strong>
                </div>
                <ul class="variable-tree"></ul>
              </li>
            `);
            
            const calculationList = calculationNode.find("ul");
            
            calculations.forEach(calc => {
              const calcItem = $(`
                <li>
                  <div class="variable-item" data-type="calculation" data-id="${calc.id}">
                    <i class="fas fa-calculator icon calc-icon"></i>
                    ${escapeHtml(calc.title)}
                    <span class="badge badge-success ml-1">Calculation</span>
                  </div>
                </li>
              `);
              
              calcItem.find(".variable-item").on("click", function() {
                showVariableDetails("calculation", calc.id);
              });
              
              calculationList.append(calcItem);
            });
            
            rootTree.append(calculationNode);
          }
          
          // Add functions
          if (hasFunctions && (filterType === "all" || filterType === "function")) {
            const functionNode = $(`
              <li>
                <div class="variable-item">
                  <i class="fas fa-code icon"></i>
                  <strong>Functions</strong>
                </div>
                <ul class="variable-tree"></ul>
              </li>
            `);
            
            const functionList = functionNode.find("ul");
            
            functions.forEach(func => {
              const funcItem = $(`
                <li>
                  <div class="variable-item" data-type="function" data-name="${func.name}">
                    <i class="fas fa-code icon func-icon"></i>
                    ${escapeHtml(func.name)}
                    <span class="badge badge-warning ml-1">Function</span>
                  </div>
                </li>
              `);
              
              funcItem.find(".variable-item").on("click", function() {
                showVariableDetails("function", func.name);
              });
              
              functionList.append(funcItem);
            });
            
            rootTree.append(functionNode);
          }
        })
        .catch(error => {
          console.error("Error loading variables:", error);
          rootTree.html(`
            <li class="text-danger text-center py-3">
              Error loading variables: ${escapeHtml(error.message)}
            </li>
          `);
        });
    }
    
    /**
     * Load parameter variables
     * @param {string} searchTerm - Optional search term to filter parameters
     * @param {string} filterType - Optional filter by variable type
     * @returns {Promise<Array>} Promise that resolves with parameter variables
     */
    function loadParameterVariables(searchTerm = "", filterType = "all") {
      if (filterType !== "all" && filterType !== "parameter") {
        return Promise.resolve([]);
      }
      
      if (!_currentCalculation) {
        return Promise.resolve([]);
      }
      
      // Filter parameters based on search term
      const parameters = _currentCalculation.parameters || [];
      const filteredParameters = parameters.filter(param => {
        if (!searchTerm) return true;
        
        const searchableTerm = searchTerm.toLowerCase();
        const searchableText = (
          param.name.toLowerCase() + " " +
          (param.label || "").toLowerCase() + " " +
          (param.description || "").toLowerCase()
        );
        
        return searchableText.includes(searchableTerm);
      });
      
      return Promise.resolve(filteredParameters);
    }
    
    /**
     * Load calculation variables
     * @param {string} searchTerm - Optional search term to filter calculations
     * @param {string} filterType - Optional filter by variable type
     * @returns {Promise<Array>} Promise that resolves with calculation variables
     */
    function loadCalculationVariables(searchTerm = "", filterType = "all") {
      if (filterType !== "all" && filterType !== "calculation") {
        return Promise.resolve([]);
      }
      
      return window.calculationsDB.calculations.getAll({ searchTerm, isPublic: true })
        .then(calculations => {
          // Exclude current calculation
          return calculations.filter(calc => {
            return !_currentCalculation || calc.id !== _currentCalculation.id;
          });
        });
    }
    
    /**
     * Load function variables
     * @param {string} searchTerm - Optional search term to filter functions
     * @param {string} filterType - Optional filter by variable type
     * @returns {Promise<Array>} Promise that resolves with function variables
     */
    function loadFunctionVariables(searchTerm = "", filterType = "all") {
      if (filterType !== "all" && filterType !== "function") {
        return Promise.resolve([]);
      }
      
      return window.calculationsDB.functions.getAll({ searchTerm, globalOnly: true });
    }
    
    /**
     * Filter variable browser by search term
     * @param {string} searchTerm - Search term to filter variables
     * @param {boolean} isModal - Whether this is being used in the modal
     */
    function filterVariableBrowser(searchTerm = "", isModal = false) {
      // Get the filter type (from the active filter button)
      const filterButtons = isModal ? 
        $("#modalVariableBrowser").parent().find(".variable-type-filter .btn") :
        $(".variable-type-filter .btn");
      
      const activeFilter = filterButtons.filter(".active").data("filter") || "all";
      
      // Reload the variable browser
      loadVariableBrowser(searchTerm, activeFilter, isModal);
    }
    
    /**
     * Show variable details
     * @param {string} type - Variable type (parameter, calculation, function)
     * @param {string|number} id - Variable ID or name
     */
    function showVariableDetails(type, id) {
      // Clear current details
      $("#variableInfoContent").hide();
      $(".parameter-details, .calculation-details, .function-details").hide();
      $("#variableValueDisplay").hide();
      
      // Update variable name and type
      $("#variableNameDisplay").text("Loading...");
      $("#variableTypeDisplay").text(type.charAt(0).toUpperCase() + type.slice(1));
      
      switch (type) {
        case "parameter":
          showParameterDetails(id);
          break;
        case "calculation":
          showCalculationDetails(id);
          break;
        case "function":
          showFunctionDetails(id);
          break;
      }
    }
    
    /**
     * Show parameter details
     * @param {string} paramName - Parameter name
     */
    function showParameterDetails(paramName) {
      if (!_currentCalculation || !_currentCalculation.parameters) {
        $("#variableInfoContent").hide();
        $("#variableValueDisplay").hide();
        return;
      }
      
      // Find the parameter
      const param = _currentCalculation.parameters.find(p => p.name === paramName);
      if (!param) {
        $("#variableInfoContent").hide();
        $("#variableValueDisplay").hide();
        return;
      }
      
      // Update variable name
      $("#variableNameDisplay").text(param.name);
      
      // Show parameter details
      $("#paramLabelDisplay").text(param.label || param.name);
      $("#paramDataTypeDisplay").text(getParameterTypeLabel(param.type));
      $("#paramDefaultDisplay").text(
        param.defaultValue !== undefined ? 
        formatParameterDefault(param) : 
        "<em>None</em>"
      );
      $("#paramUnitDisplay").text(param.unit || "<em>None</em>");
      $("#paramDescDisplay").text(param.description || "<em>No description</em>");
      
      // Show parameter container
      $(".parameter-details").show();
      $("#variableInfoContent").show();
      
      // Show current value
      const cachedResult = window.calculationsEngine.getCachedResult(_currentCalculation.id);
      if (cachedResult && cachedResult.params && cachedResult.params[param.name] !== undefined) {
        $("#currentValueDisplay").text(String(cachedResult.params[param.name]));
        $("#valueUnitDisplay").text(param.unit || "");
        $("#lastUpdatedDisplay").text(formatDateTime(cachedResult.timestamp));
        $("#variableValueDisplay").show();
      } else {
        $("#variableValueDisplay").hide();
      }
      
      // Load "used in" information
      $("#usedInContainer").html('<p class="text-muted">Loading references...</p>');
      
      // For parameters, they're only used in the current calculation
      $("#usedInContainer").html(`
        <ul class="list-group">
          <li class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <i class="fas fa-calculator mr-2"></i>
                ${escapeHtml(_currentCalculation.title)}
              </div>
              <button class="btn btn-sm btn-outline-primary view-variable-ref-btn" data-type="calculation" data-id="${_currentCalculation.id}">
                <i class="fas fa-external-link-alt"></i> View
              </button>
            </div>
          </li>
        </ul>
      `);
      
      // Set up view button
      $(".view-variable-ref-btn").on("click", function() {
        const refType = $(this).data("type");
        const refId = $(this).data("id");
        
        if (refType === "calculation") {
          loadCalculationExecution(refId);
        }
      });
    }
    
    /**
     * Show calculation details
     * @param {number} calcId - Calculation ID
     */
    function showCalculationDetails(calcId) {
      window.calculationsDB.calculations.get(calcId)
        .then(calc => {
          if (!calc) {
            $("#variableInfoContent").hide();
            $("#variableValueDisplay").hide();
            return;
          }
          
          // Update variable name
          $("#variableNameDisplay").text(calc.title);
          
          // Show calculation details
          $("#calcTitleDisplay").text(calc.title);
          $("#calcDescDisplay").text(calc.description || "<em>No description</em>");
          $("#calcResultTypeDisplay").text(calc.resultFormat || "auto");
          $("#calcUnitDisplay").text(calc.resultUnit || "<em>None</em>");
          
          // Show calculation container
          $(".calculation-details").show();
          $("#variableInfoContent").show();
          
          // Set up open button
          $("#openCalcBtn").off("click").on("click", function() {
            loadCalculationExecution(calcId);
          });
          
          // Show current value
          const cachedResult = window.calculationsEngine.getCachedResult(calcId);
          if (cachedResult && cachedResult.formattedResult !== undefined) {
            if (typeof cachedResult.formattedResult === "object") {
              $("#currentValueDisplay").text(JSON.stringify(cachedResult.formattedResult));
            } else {
              $("#currentValueDisplay").text(String(cachedResult.formattedResult));
            }
            
            $("#valueUnitDisplay").text(calc.resultUnit || "");
            $("#lastUpdatedDisplay").text(formatDateTime(cachedResult.timestamp));
            $("#variableValueDisplay").show();
          } else {
            $("#variableValueDisplay").hide();
          }
          
          // Load "used in" information
          $("#usedInContainer").html('<p class="text-muted">Loading references...</p>');
          
          return window.calculationsEngine.getDependentCalculations(calcId);
        })
        .then(dependentIds => {
          if (!dependentIds || dependentIds.length === 0) {
            $("#usedInContainer").html('<p class="text-muted">Not used in any calculations</p>');
            return;
          }
          
          // Load dependent calculation details
          const dependentPromises = dependentIds.map(id => window.calculationsDB.calculations.get(id));
          return Promise.all(dependentPromises);
        })
        .then(dependentCalcs => {
          if (!dependentCalcs || dependentCalcs.length === 0) {
            return;
          }
          
          let html = '<ul class="list-group">';
          dependentCalcs.forEach(calc => {
            if (!calc) return;
            
            html += `
              <li class="list-group-item">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <i class="fas fa-calculator mr-2"></i>
                    ${escapeHtml(calc.title)}
                  </div>
                  <button class="btn btn-sm btn-outline-primary view-variable-ref-btn" data-type="calculation" data-id="${calc.id}">
                    <i class="fas fa-external-link-alt"></i> View
                  </button>
                </div>
              </li>
            `;
          });
          html += '</ul>';
          
          $("#usedInContainer").html(html);
          
          // Set up view buttons
          $(".view-variable-ref-btn").on("click", function() {
            const refType = $(this).data("type");
            const refId = $(this).data("id");
            
            if (refType === "calculation") {
              loadCalculationExecution(refId);
            }
          });
        })
        .catch(error => {
          console.error("Error loading calculation details:", error);
          $("#variableInfoContent").hide();
          $("#variableValueDisplay").hide();
        });
    }
    
    /**
     * Show function details
     * @param {string} funcName - Function name
     */
    function showFunctionDetails(funcName) {
      window.calculationsDB.functions.get(funcName)
        .then(func => {
          if (!func) {
            $("#variableInfoContent").hide();
            $("#variableValueDisplay").hide();
            return;
          }
          
          // Update variable name
          $("#variableNameDisplay").text(func.name);
          
          // Show function details
          $("#functionSignatureDisplay").text(`function ${func.name}(${func.params.join(", ")}) { ... }`);
          $("#functionDescDisplay").text(func.description || "No description available.");
          
          // Show function parameters
          $("#functionParamsBody").empty();
        
        if (func.params && func.params.length > 0) {
          func.params.forEach(param => {
            $("#functionParamsBody").append(`
              <tr>
                <td><code>${escapeHtml(param)}</code></td>
                <td><em>No description available</em></td>
              </tr>
            `);
          });
        } else {
          $("#functionParamsBody").append(`
            <tr>
              <td colspan="2" class="text-muted">No parameters</td>
            </tr>
          `);
        }
        
        // Show function container
        $(".function-details").show();
        $("#variableInfoContent").show();
        
        // Set up open button
        $("#openFuncBtn").off("click").on("click", function() {
          loadFunctionEdit(funcName);
          $("#functions-tab").tab("show");
        });
        
        // Function doesn't have a current value to display
        $("#variableValueDisplay").hide();
        
        // Load "used in" information
        $("#usedInContainer").html('<p class="text-muted">Loading references...</p>');
        
        // Find calculations that use this function
        // This is more complex, as we need to check calculation code
        return window.calculationsDB.calculations.getAll();
      })
      .then(calculations => {
        if (!calculations || calculations.length === 0) {
          $("#usedInContainer").html('<p class="text-muted">Not used in any calculations</p>');
          return;
        }
        
        // Filter calculations that use this function
        const usedInCalculations = calculations.filter(calc => {
          // Check for function usage based on calculation type
          switch (calc.type) {
            case "standard":
              // For standard calculations, check if the equation contains the function name
              return calc.equation && calc.equation.includes(funcName + "(");
              
            case "custom-js":
            case "custom-py":
              // For custom code calculations, check if the code contains the function name
              return calc.customCode && calc.customCode.includes(funcName);
              
            default:
              return false;
          }
        });
        
        if (usedInCalculations.length === 0) {
          $("#usedInContainer").html('<p class="text-muted">Not used in any calculations</p>');
          return;
        }
        
        let html = '<ul class="list-group">';
        usedInCalculations.forEach(calc => {
          html += `
            <li class="list-group-item">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <i class="fas fa-calculator mr-2"></i>
                  ${escapeHtml(calc.title)}
                </div>
                <button class="btn btn-sm btn-outline-primary view-variable-ref-btn" data-type="calculation" data-id="${calc.id}">
                  <i class="fas fa-external-link-alt"></i> View
                </button>
              </div>
            </li>
          `;
        });
        html += '</ul>';
        
        $("#usedInContainer").html(html);
        
        // Set up view buttons
        $(".view-variable-ref-btn").on("click", function() {
          const refType = $(this).data("type");
          const refId = $(this).data("id");
          
          if (refType === "calculation") {
            loadCalculationExecution(refId);
          }
        });
      })
      .catch(error => {
        console.error("Error loading function details:", error);
        $("#variableInfoContent").hide();
        $("#variableValueDisplay").hide();
      });
  }
  
  /**
   * Open the variable browser modal
   */
  function openVariableBrowser() {
    // Initialize the modal variable browser
    loadVariableBrowser("", "all", true);
    
    // Show the modal
    $("#variableBrowserModal").modal("show");
  }
  
  /**
   * Open the function browser
   */
  function openFunctionBrowser() {
    // Show the functions tab
    $("#functions-tab").tab("show");
  }
  
  /**
   * Insert a variable reference into the equation input
   */
  function insertVariableReference(type, id, name) {
    const input = $("#equationInput");
    let insertText = "";
    
    switch (type) {
      case "parameter":
        insertText = name;
        break;
      case "calculation":
        // For calculations, we can't directly reference them in equations
        showNotification("Calculations can't be directly referenced in equations. Use a parameter of type 'calculation' instead.", "warning");
        return;
      case "function":
        insertText = `${name}()`;
        break;
    }
    
    // Get the current cursor position
    const start = input[0].selectionStart;
    const end = input[0].selectionEnd;
    
    // Insert the text at the cursor position
    const currentValue = input.val();
    input.val(currentValue.substring(0, start) + insertText + currentValue.substring(end));
    
    // Set cursor position after the inserted text
    input[0].selectionStart = start + insertText.length;
    input[0].selectionEnd = start + insertText.length;
    
    // Focus on the input
    input.focus();
    
    // Close the modal
    $("#variableBrowserModal").modal("hide");
  }

  /**
   * Save general settings
   * @param {Event} event - Form submit event
   */
  function saveGeneralSettings(event) {
    event.preventDefault();
    
    const settings = {
      id: "generalSettings",
      defaultDecimalPlaces: parseInt($("#defaultDecimalPlaces").val()),
      defaultNumberFormat: $("#defaultNumberFormat").val(),
      autoCalculate: $("#autoCalculate").prop("checked"),
      storeResultsHistory: $("#storeResultsHistory").prop("checked"),
      showFunctionTooltips: $("#showFunctionTooltips").prop("checked")
    };
    
    window.calculationsDB.settings.save(settings)
      .then(() => {
        _settings = settings;
        showNotification("Settings saved successfully", "success");
      })
      .catch(error => {
        console.error("Error saving settings:", error);
        showNotification("Error saving settings: " + error.message, "danger");
      });
  }
  
  /**
   * Save OpenAI API settings
   * @param {Event} event - Form submit event
   */
  function saveOpenAISettings(event) {
    event.preventDefault();
    
    const settings = {
      id: "openAISettings",
      apiKey: $("#openaiApiKey").val(),
      model: $("#openaiModel").val(),
      aiSuggestParams: $("#aiSuggestParams").prop("checked"),
      aiCodeHelp: $("#aiCodeHelp").prop("checked"),
      aiErrorHelp: $("#aiErrorHelp").prop("checked")
    };
    
    window.calculationsDB.settings.save(settings)
      .then(() => {
        showNotification("API settings saved successfully", "success");
      })
      .catch(error => {
        console.error("Error saving API settings:", error);
        showNotification("Error saving API settings: " + error.message, "danger");
      });
  }
  
  /**
   * Toggle API key visibility
   */
  function toggleApiKeyVisibility() {
    const apiKeyInput = $("#openaiApiKey");
    const toggleBtn = $("#toggleApiKeyBtn");
    
    if (apiKeyInput.attr("type") === "password") {
      apiKeyInput.attr("type", "text");
      toggleBtn.html('<i class="fas fa-eye-slash"></i>');
    } else {
      apiKeyInput.attr("type", "password");
      toggleBtn.html('<i class="fas fa-eye"></i>');
    }
  }
  
  /**
   * Test OpenAI API connection
   */
  function testOpenAIConnection() {
    const apiKey = $("#openaiApiKey").val();
    const model = $("#openaiModel").val();
    
    if (!apiKey) {
      showNotification("Please enter an API key first", "warning");
      return;
    }
    
    // Show loading indicator
    $("#apiTestResult").html(`
      <div class="alert alert-info">
        <i class="fas fa-spinner fa-spin"></i> Testing connection...
      </div>
    `).show();
    
    // Test the API
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "You are a helpful assistant for a calculation system." },
          { role: "user", content: "Respond with 'Connection successful' if you receive this message." }
        ],
        max_tokens: 20
      })
    })
      .then(response => {
        if (!response.ok) {
          return response.json().then(data => {
            throw new Error(data.error?.message || "API request failed");
          });
        }
        return response.json();
      })
      .then(data => {
        const response = data.choices[0].message.content;
        $("#apiTestResult").html(`
          <div class="alert alert-success">
            <i class="fas fa-check-circle"></i> Connection successful!
            <p class="mb-0 mt-2">Response: ${escapeHtml(response)}</p>
          </div>
        `);
      })
      .catch(error => {
        console.error("OpenAI API error:", error);
        $("#apiTestResult").html(`
          <div class="alert alert-danger">
            <i class="fas fa-exclamation-circle"></i> Connection failed
            <p class="mb-0 mt-2">Error: ${escapeHtml(error.message)}</p>
          </div>
        `);
      });
  }
  
  /**
   * Toggle Brython settings
   */
  function toggleBrythonSettings() {
    const isEnabled = $("#enableBrython").prop("checked");
    $("#brythonSettings").toggle(isEnabled);
  }
  
  /**
   * Save Brython settings
   */
  function saveBrythonSettings() {
    const settings = {
      id: "brythonSettings",
      enabled: $("#enableBrython").prop("checked"),
      modules: $("#brythonModules").val(),
      pythonVersion: $("#pythonVersion").val()
    };
    
    window.calculationsDB.settings.save(settings)
      .then(() => {
        showNotification("Python settings saved. Page reload required to apply changes.", "success");
      })
      .catch(error => {
        console.error("Error saving Brython settings:", error);
        showNotification("Error saving Python settings: " + error.message, "danger");
      });
  }
  
  /**
   * Export all data
   */
  function exportAllData() {
    window.calculationsDB.export()
      .then(data => {
        // Create a download
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement("a");
        a.href = url;
        a.download = `calculations_export_${formatDateForFilename(new Date())}.json`;
        a.click();
        
        // Clean up
        URL.revokeObjectURL(url);
        
        showNotification("Data exported successfully", "success");
      })
      .catch(error => {
        console.error("Error exporting data:", error);
        showNotification("Error exporting data: " + error.message, "danger");
      });
  }
  
  /**
   * Export calculations only
   */
  function exportCalculations() {
    window.calculationsDB.export({
      includeCalculations: true,
      includeFunctions: false,
      includeSettings: false,
      includeHistory: false
    })
      .then(data => {
        // Create a download
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement("a");
        a.href = url;
        a.download = `calculations_export_${formatDateForFilename(new Date())}.json`;
        a.click();
        
        // Clean up
        URL.revokeObjectURL(url);
        
        showNotification("Calculations exported successfully", "success");
      })
      .catch(error => {
        console.error("Error exporting calculations:", error);
        showNotification("Error exporting calculations: " + error.message, "danger");
      });
  }
  
  /**
   * Export functions only
   */
  function exportFunctions() {
    window.calculationsDB.export({
      includeCalculations: false,
      includeFunctions: true,
      includeSettings: false,
      includeHistory: false
    })
      .then(data => {
        // Create a download
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement("a");
        a.href = url;
        a.download = `functions_export_${formatDateForFilename(new Date())}.json`;
        a.click();
        
        // Clean up
        URL.revokeObjectURL(url);
        
        showNotification("Functions exported successfully", "success");
      })
      .catch(error => {
        console.error("Error exporting functions:", error);
        showNotification("Error exporting functions: " + error.message, "danger");
      });
  }
  
  /**
   * Handle import file selection
   * @param {Event} event - File input change event
   */
  function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const importData = JSON.parse(e.target.result);
        
        // Validate import data
        if (!importData.metadata || importData.metadata.type !== "AdvancedCalculationsExport") {
          throw new Error("Invalid import data format");
        }
        
        // Show confirmation dialog
        $("#confirmationMessage").html(`
          <p>Are you sure you want to import this data?</p>
          <ul>
            <li>Calculations: ${importData.calculations ? importData.calculations.length : 0}</li>
            <li>Functions: ${importData.functions ? importData.functions.length : 0}</li>
            <li>Settings: ${importData.settings ? importData.settings.length : 0}</li>
            <li>History entries: ${importData.history ? importData.history.length : 0}</li>
          </ul>
          <p><strong>Note:</strong> This will overwrite any existing items with the same ID.</p>
        `);
        
        $("#confirmActionBtn").off("click").on("click", function() {
          // Hide the confirmation dialog
          $("#confirmationModal").modal("hide");
          
          // Import the data
          window.calculationsDB.import(importData, { overwrite: true })
            .then(results => {
              const message = `
                Import completed successfully:
                <ul>
                  <li>Calculations: ${results.calculations.added} added, ${results.calculations.updated} updated</li>
                  <li>Functions: ${results.functions.added} added, ${results.functions.updated} updated</li>
                  <li>Settings: ${results.settings.added} added, ${results.settings.updated} updated</li>
                  <li>History entries: ${results.history.added} added</li>
                </ul>
              `;
              
              showNotification(message, "success", 5000);
              
              // Reload data
              loadCalculations();
              loadFunctions();
              
              // Reload settings if they were imported
              if (results.settings.added > 0 || results.settings.updated > 0) {
                window.calculationsDB.settings.get("generalSettings")
                  .then(settings => {
                    if (settings) {
                      _settings = settings;
                      applySettings();
                    }
                  });
              }
            })
            .catch(error => {
              console.error("Error importing data:", error);
              showNotification("Error importing data: " + error.message, "danger");
            });
        });
        
        // Show the confirmation dialog
        $("#confirmationModal").modal("show");
      } catch (error) {
        console.error("Error parsing import file:", error);
        showNotification("Error parsing import file: " + error.message, "danger");
      }
    };
    
    reader.readAsText(file);
  }
  
  /**
   * Confirm clearing all data
   */
  function confirmClearAllData() {
    $("#confirmationMessage").html(`
      <p><strong>Warning:</strong> This will permanently delete all your data including:</p>
      <ul>
        <li>All calculations</li>
        <li>All functions</li>
        <li>All calculation history</li>
      </ul>
      <p>Settings will be reset to defaults.</p>
      <p>This action cannot be undone. Are you sure you want to proceed?</p>
    `);
    
    $("#confirmActionBtn").off("click").on("click", function() {
      // Hide the confirmation dialog
      $("#confirmationModal").modal("hide");
      
      // Clear all data
      window.calculationsDB.clearAll()
        .then(() => {
          showNotification("All data has been cleared", "success");
          
          // Reload the page to apply changes
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        })
        .catch(error => {
          console.error("Error clearing data:", error);
          showNotification("Error clearing data: " + error.message, "danger");
        });
    });
    
    // Show the confirmation dialog
    $("#confirmationModal").modal("show");
  }
  
  /**
   * Show a notification
   * @param {string} message - Notification message
   * @param {string} type - Notification type (success, info, warning, danger)
   * @param {number} duration - Duration in milliseconds (default: 3000)
   */
  function showNotification(message, type = "success", duration = 3000) {
    // Check if toast container exists, if not create it
    if ($("#toastContainer").length === 0) {
      $("body").append('<div id="toastContainer" class="toast-container"></div>');
    }
    
    // Create a unique ID for the toast
    const id = "toast-" + Date.now();
    
    // Create the toast
    const toast = $(`
      <div class="toast" id="${id}" role="alert" aria-live="assertive" aria-atomic="true" data-autohide="true" data-delay="${duration}">
        <div class="toast-header bg-${type} text-white">
          <i class="fas fa-${getIconForType(type)} mr-2"></i>
          <strong class="mr-auto">${getNotificationTitle(type)}</strong>
          <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="toast-body">
          ${message}
        </div>
      </div>
    `);
    
    // Add the toast to the container
    $("#toastContainer").append(toast);
    
    // Show the toast
    toast.toast("show");
    
    // Remove the toast when hidden
    toast.on("hidden.bs.toast", function() {
      $(this).remove();
    });
  }
  
  /**
   * Get icon for notification type
   * @param {string} type - Notification type
   * @returns {string} Icon name
   */
  function getIconForType(type) {
    switch (type) {
      case "success": return "check-circle";
      case "info": return "info-circle";
      case "warning": return "exclamation-triangle";
      case "danger": return "exclamation-circle";
      default: return "bell";
    }
  }
  
  /**
   * Get title for notification type
   * @param {string} type - Notification type
   * @returns {string} Title
   */
  function getNotificationTitle(type) {
    switch (type) {
      case "success": return "Success";
      case "info": return "Information";
      case "warning": return "Warning";
      case "danger": return "Error";
      default: return "Notification";
    }
  }
  
  /**
   * Format date as user-friendly string
   * @param {Date|string} date - Date to format
   * @returns {string} Formatted date
   */
  function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString();
  }
  
  /**
   * Format date and time as user-friendly string
   * @param {Date|string} date - Date to format
   * @returns {string} Formatted date and time
   */
  function formatDateTime(date) {
    const d = new Date(date);
    return d.toLocaleString();
  }
  
  /**
   * Format date for filename
   * @param {Date} date - Date to format
   * @returns {string} Formatted date (YYYY-MM-DD)
   */
  function formatDateForFilename(date) {
    const d = new Date(date);
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }
  
  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    if (text === undefined || text === null) {
      return "";
    }
    
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  
  // Return public API
  return {
    init,
    
    // Calculation methods
    loadCalculations,
    newCalculation,
    loadCalculationEdit,
    loadCalculationExecution,
    executeCalculation,
    
    // Function methods
    loadFunctions,
    newFunction,
    loadFunctionEdit,
    
    // Variable methods
    loadVariableBrowser,
    showVariableDetails,
    
    // Utility methods
    showNotification
  };
})();

// Initialize the UI when the page is loaded
document.addEventListener("DOMContentLoaded", function() {
  window.calculationsUI.init();
});