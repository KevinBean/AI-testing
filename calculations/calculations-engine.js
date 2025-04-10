/**
 * Advanced Calculations Engine
 * Handles the execution of various calculation types and manages dependencies
 */

// Create a namespace for the calculations engine
window.calculationsEngine = (function() {
  // Private properties
  let _userFunctions = {};
  let _calculationCache = {};
  let _calculationDependencies = {};
  let _executionLog = [];
  let _settings = {};
  
  /**
   * Initialize the engine
   * @returns {Promise} Promise that resolves when the engine is initialized
   */
  function init() {
    return new Promise((resolve, reject) => {
      // Load settings
      window.calculationsDB.settings.get("generalSettings")
        .then(settings => {
          _settings = settings || {};
          
          // Load user-defined functions
          return window.calculationsDB.functions.getAll({ globalOnly: true });
        })
        .then(functions => {
          // Register all global functions
          functions.forEach(func => {
            registerFunction(func);
          });
          
          console.log("Calculation engine initialized with", functions.length, "user functions");
          resolve();
        })
        .catch(error => {
          console.error("Error initializing calculation engine:", error);
          reject(error);
        });
    });
  }
  
  /**
   * Register a function for use in calculations
   * @param {Object} functionDef - Function definition
   * @param {string} functionDef.name - Function name
   * @param {string} functionDef.code - Function code
   * @param {Array<string>} functionDef.params - Function parameters
   */
  function registerFunction(functionDef) {
    try {
      // Create a new function from the code
      const functionBody = functionDef.code;
      const functionParams = functionDef.params || [];
      
      // Safely create the function
      _userFunctions[functionDef.name] = new Function(...functionParams, functionBody);
      
      console.log(`Registered function: ${functionDef.name}(${functionParams.join(", ")})`);
      return true;
    } catch (error) {
      console.error(`Error registering function ${functionDef.name}:`, error);
      return false;
    }
  }
  
  /**
   * Unregister a function
   * @param {string} functionName - Name of the function to unregister
   */
  function unregisterFunction(functionName) {
    if (_userFunctions[functionName]) {
      delete _userFunctions[functionName];
      return true;
    }
    return false;
  }
  
  /**
   * Execute a calculation
   * @param {Object} calculation - The calculation to execute
   * @param {Object} paramValues - Values for the calculation parameters
   * @param {Object} options - Execution options
   * @param {boolean} options.useCache - Whether to use cached results for referenced calculations
   * @param {boolean} options.saveHistory - Whether to save the calculation result to history
   * @param {boolean} options.detailed - Whether to return detailed execution information
   * @returns {Promise} Promise that resolves with the calculation result
   */
  function executeCalculation(calculation, paramValues = {}, options = {}) {
    // Default options
    const defaultOptions = {
      useCache: true,
      saveHistory: true, 
      detailed: false
    };
    
    options = { ...defaultOptions, ...options };
    
    // Reset execution log for this calculation
    _executionLog = [];
    
    // Log the execution start
    log(`Executing calculation: ${calculation.title} (ID: ${calculation.id})`);
    log(`Parameters:`, paramValues);
    
    return new Promise((resolve, reject) => {
      try {
        // Resolve parameter values (handle calculation references)
        resolveParameterValues(calculation, paramValues, options)
          .then(resolvedParams => {
            log("Resolved parameters:", resolvedParams);
            
            // Execute the calculation based on its type
            let executionPromise;
            
            switch (calculation.type) {
              case "standard":
                executionPromise = executeStandardCalculation(calculation, resolvedParams);
                break;
              case "custom-js":
                executionPromise = executeCustomJSCalculation(calculation, resolvedParams);
                break;
              case "custom-py":
                executionPromise = executeCustomPythonCalculation(calculation, resolvedParams);
                break;
              default:
                throw new Error(`Unknown calculation type: ${calculation.type}`);
            }
            
            executionPromise
              .then(result => {
                log("Calculation result:", result);
                
                // Format the result based on calculation settings
                const formattedResult = formatResult(result, calculation);
                
                // Update cache
                _calculationCache[calculation.id] = {
                  result: result,
                  formattedResult: formattedResult,
                  timestamp: new Date(),
                  params: { ...resolvedParams }
                };
                
                // Save to history if enabled
                if (options.saveHistory && calculation.storeHistory !== false) {
                  window.calculationsDB.history.save({
                    calculationId: calculation.id,
                    result: result,
                    formattedResult: formattedResult,
                    params: { ...resolvedParams },
                    timestamp: new Date()
                  }).catch(error => {
                    console.error("Error saving calculation history:", error);
                  });
                }
                
                // Return detailed information if requested
                if (options.detailed) {
                  resolve({
                    result: result,
                    formattedResult: formattedResult,
                    log: _executionLog,
                    parameters: resolvedParams,
                    timestamp: new Date()
                  });
                } else {
                  resolve(formattedResult);
                }
              })
              .catch(error => {
                log("Calculation error:", error.message);
                reject(error);
              });
          })
          .catch(error => {
            log("Parameter resolution error:", error.message);
            reject(error);
          });
      } catch (error) {
        log("Execution preparation error:", error.message);
        reject(error);
      }
    });
  }
  
  /**
   * Resolve parameter values, including referenced calculations
   * @param {Object} calculation - The calculation
   * @param {Object} paramValues - Raw parameter values
   * @param {Object} options - Execution options
   * @returns {Promise} Promise that resolves with resolved parameter values
   */
  function resolveParameterValues(calculation, paramValues, options) {
    return new Promise((resolve, reject) => {
      const resolvedParams = { ...paramValues };
      const parameterPromises = [];
      
      // Track dependencies for this calculation
      _calculationDependencies[calculation.id] = [];
      
      // Process parameters that reference other calculations
      if (calculation.parameters) {
        calculation.parameters.forEach(param => {
          // Skip if this parameter already has a value provided
          if (resolvedParams[param.name] !== undefined) {
            return;
          }
          
          // If parameter is a calculation reference
          if (param.type === "calculation" && param.calcReference) {
            const refCalculationId = parseInt(param.calcReference);
            _calculationDependencies[calculation.id].push(refCalculationId);
            
            parameterPromises.push(
              new Promise((resolveParam, rejectParam) => {
                // Check if we have a cached result and should use it
                if (options.useCache && _calculationCache[refCalculationId]) {
                  log(`Using cached result for calculation ${refCalculationId}`);
                  let value = _calculationCache[refCalculationId].result;
                  
                  // Extract property from result if specified
                  if (param.resultProperty && typeof value === 'object' && value !== null) {
                    value = value[param.resultProperty];
                  }
                  
                  resolvedParams[param.name] = value;
                  resolveParam();
                } else {
                  // Fetch and execute the referenced calculation
                  window.calculationsDB.calculations.get(refCalculationId)
                    .then(refCalculation => {
                      if (!refCalculation) {
                        throw new Error(`Referenced calculation not found: ${refCalculationId}`);
                      }
                      
                      // Execute the referenced calculation without saving to history
                      return executeCalculation(refCalculation, {}, { 
                        saveHistory: false, 
                        useCache: options.useCache 
                      });
                    })
                    .then(refResult => {
                      // Extract property from result if specified
                      if (param.resultProperty && typeof refResult === 'object' && refResult !== null) {
                        refResult = refResult[param.resultProperty];
                      }
                      
                      resolvedParams[param.name] = refResult;
                      resolveParam();
                    })
                    .catch(error => {
                      log(`Error resolving referenced calculation ${refCalculationId}: ${error.message}`);
                      rejectParam(error);
                    });
                }
              })
            );
          } else if (param.defaultValue !== undefined) {
            // Use default value if provided
            resolvedParams[param.name] = param.defaultValue;
          }
        });
      }
      
      // Wait for all parameter promises to resolve
      Promise.all(parameterPromises)
        .then(() => {
          resolve(resolvedParams);
        })
        .catch(reject);
    });
  }
  
  /**
   * Execute a standard calculation using math.js
   * @param {Object} calculation - The calculation to execute
   * @param {Object} params - Parameter values
   * @returns {Promise} Promise that resolves with the result
   */
  function executeStandardCalculation(calculation, params) {
    return new Promise((resolve, reject) => {
      try {
        const equation = calculation.equation;
        
        if (!equation) {
          throw new Error("No equation provided for standard calculation");
        }
        
        log(`Executing standard equation: ${equation}`);
        
        // Create math.js context with parameters and user functions
        const context = { ...params };
        
        // Add user functions to the context
        Object.keys(_userFunctions).forEach(funcName => {
          context[funcName] = _userFunctions[funcName];
        });
        
        // Evaluate the equation
        const result = math.evaluate(equation, context);
        resolve(result);
      } catch (error) {
        reject(new Error(`Standard calculation error: ${error.message}`));
      }
    });
  }
  
  /**
   * Execute a custom JavaScript calculation
   * @param {Object} calculation - The calculation to execute
   * @param {Object} params - Parameter values
   * @returns {Promise} Promise that resolves with the result
   */
  function executeCustomJSCalculation(calculation, params) {
    return new Promise((resolve, reject) => {
      try {
        const code = calculation.customCode;
        
        if (!code) {
          throw new Error("No code provided for custom JS calculation");
        }
        
        log(`Executing custom JS code (length: ${code.length} chars)`);
        
        // Create function parameters list and values array
        const paramNames = Object.keys(params);
        const paramValues = paramNames.map(name => params[name]);
        
        // Create a context with math helper, user functions, and additional utilities
        const contextCode = `
          // Make math.js functions available
          const math = window.math;
          ${Object.keys(_userFunctions).map(name => 
            `const ${name} = this._userFunctions["${name}"];`
          ).join('\n')}
          
          // Utility functions
          const log = (...args) => { this.log(...args); };
          
          // Main calculation code
          ${code}
        `;
        
        // Create the function with parameters
        const calculationFunction = new Function(...paramNames, contextCode);
        
        // Execute the function with the context
        const context = {
          _userFunctions,
          log: (message) => log(`Custom code log: ${message}`)
        };
        
        // Execute the function with parameters
        const result = calculationFunction.apply(context, paramValues);
        resolve(result);
      } catch (error) {
        reject(new Error(`JavaScript calculation error: ${error.message}`));
      }
    });
  }
  
  /**
   * Execute a custom Python calculation using Brython
   * @param {Object} calculation - The calculation to execute
   * @param {Object} params - Parameter values
   * @returns {Promise} Promise that resolves with the result
   */
  function executeCustomPythonCalculation(calculation, params) {
    return new Promise((resolve, reject) => {
      // Check if Brython is available
      if (typeof brython !== 'function') {
        reject(new Error("Brython is not available. Enable it in settings first."));
        return;
      }
      
      try {
        const code = calculation.customCode;
        
        if (!code) {
          throw new Error("No code provided for custom Python calculation");
        }
        
        log(`Executing custom Python code (length: ${code.length} chars)`);
        
        // Create a unique ID for this execution
        const execId = `py_exec_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
        
        // Create a global variable to store the result
        window[execId] = { result: null, error: null, done: false };
        
        // Create Python script with parameters and result handling
        const pyScript = document.createElement('script');
        pyScript.type = 'text/python';
        pyScript.id = execId;
        
        // Prepare parameter initialization
        const paramInit = Object.entries(params)
          .map(([key, value]) => {
            if (typeof value === 'string') {
              return `${key} = """${value}"""`;
            } else if (typeof value === 'object' && value !== null) {
              return `${key} = ${JSON.stringify(value)}`;
            } else {
              return `${key} = ${value}`;
            }
          })
          .join('\n');
        
        // Create the Python code
        pyScript.textContent = `
import browser
import math
import json

try:
    # Initialize parameters
    ${paramInit}
    
    # Execute calculation code
    ${code}
    
    # Handle the result
    if 'result' in locals():
        if isinstance(result, dict):
            browser.window.${execId}.result = json.dumps(result)
        else:
            browser.window.${execId}.result = result
    else:
        # If no explicit result variable, use the last expression result
        last_result = ${code.split('\n').filter(line => 
          line.trim() && !line.trim().startsWith('#') && !line.trim().startsWith('import')
        ).pop() || 'None'}
        browser.window.${execId}.result = last_result
except Exception as e:
    browser.window.${execId}.error = str(e)
finally:
    browser.window.${execId}.done = True
`;
        
        // Add script to the document
        document.body.appendChild(pyScript);
        
        // Execute the Python code
        brython();
        
        // Check for completion with timeout
        const maxWaitTime = 5000; // 5 seconds
        const startTime = Date.now();
        
        const checkResult = () => {
          if (window[execId].done) {
            // Remove the script element
            document.getElementById(execId).remove();
            
            if (window[execId].error) {
              reject(new Error(`Python calculation error: ${window[execId].error}`));
            } else {
              // Parse JSON result if needed
              let result = window[execId].result;
              if (typeof result === 'string' && result.startsWith('{') && result.endsWith('}')) {
                try {
                  result = JSON.parse(result);
                } catch (e) {
                  // If parsing fails, use the string result
                }
              }
              
              resolve(result);
            }
            
            // Clean up
            delete window[execId];
          } else if (Date.now() - startTime > maxWaitTime) {
            // Remove the script element
            const scriptElement = document.getElementById(execId);
            if (scriptElement) {
              scriptElement.remove();
            }
            
            reject(new Error("Python calculation timed out"));
            
            // Clean up
            delete window[execId];
          } else {
            setTimeout(checkResult, 100);
          }
        };
        
        checkResult();
      } catch (error) {
        reject(new Error(`Python calculation setup error: ${error.message}`));
      }
    });
  }
  
  /**
   * Format a calculation result based on calculation settings
   * @param {*} result - The raw calculation result
   * @param {Object} calculation - The calculation with formatting settings
   * @returns {*} The formatted result
   */
  function formatResult(result, calculation) {
    // Handle different result types
    const resultType = calculation.resultFormat || "auto";
    const resultUnit = calculation.resultUnit || "";
    
    // For auto type, determine the result type
    let actualType = resultType;
    if (resultType === "auto") {
      if (typeof result === "number") {
        actualType = "number";
      } else if (typeof result === "string") {
        actualType = "text";
      } else if (typeof result === "boolean") {
        actualType = "boolean";
      } else if (Array.isArray(result)) {
        actualType = "array";
      } else if (typeof result === "object" && result !== null) {
        actualType = "object";
      }
    }
    
    // Format based on the type
    switch (actualType) {
      case "number":
        return formatNumberResult(result, calculation);
      
      case "boolean":
        return result ? "True" : "False";
      
      case "array":
        return result.map(item => {
          if (typeof item === "number") {
            return formatNumberResult(item, calculation);
          }
          return item;
        });
      
      case "object":
        // Format each number property in the object
        const formattedObject = { ...result };
        for (let key in formattedObject) {
          if (typeof formattedObject[key] === "number") {
            formattedObject[key] = formatNumberResult(formattedObject[key], calculation);
          }
        }
        return formattedObject;
      
      default:
        // For text or any other type, return as is
        return result;
    }
  }
  
  /**
   * Format a number result
   * @param {number} value - The number to format
   * @param {Object} calculation - The calculation with formatting settings
   * @returns {string} The formatted number
   */
  function formatNumberResult(value, calculation) {
    if (typeof value !== "number" || isNaN(value)) {
      return value; // Return unchanged if not a number
    }
    
    // Get formatting settings
    const decimalPlaces = calculation.decimalPlaces !== undefined ? 
      calculation.decimalPlaces : 
      (_settings.defaultDecimalPlaces || 2);
    
    const numberFormat = calculation.numberFormat || 
      (_settings.defaultNumberFormat || "decimal");
    
    // Apply the appropriate format
    let formattedValue;
    switch (numberFormat) {
      case "scientific":
        formattedValue = value.toExponential(decimalPlaces);
        break;
      
      case "engineering":
        // Engineering notation (power of 3)
        const exp = Math.floor(Math.log10(Math.abs(value)) / 3) * 3;
        formattedValue = (value / Math.pow(10, exp)).toFixed(decimalPlaces) + "E" + exp;
        break;
      
      case "percent":
        formattedValue = (value * 100).toFixed(decimalPlaces) + "%";
        break;
      
      case "decimal":
      default:
        formattedValue = value.toFixed(decimalPlaces);
        
        // Add thousand separators
        formattedValue = formattedValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        break;
    }
    
    return formattedValue;
  }
  
  /**
   * Test a function with the given parameters
   * @param {Object} functionDef - Function definition
   * @param {Object} params - Test parameters
   * @returns {Promise} Promise that resolves with the test result
   */
  function testFunction(functionDef, params) {
    return new Promise((resolve, reject) => {
      try {
        // Create a new function from the code
        const functionBody = functionDef.code;
        const functionParams = functionDef.params || [];
        
        // Create the function
        const func = new Function(...functionParams, functionBody);
        
        // Prepare parameter values
        const paramValues = functionParams.map(param => params[param]);
        
        // Execute the function
        const result = func(...paramValues);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Get the dependencies for a calculation
   * @param {number} calculationId - The ID of the calculation
   * @returns {Promise} Promise that resolves with the dependencies
   */
  function getCalculationDependencies(calculationId) {
    return new Promise((resolve, reject) => {
      // If we already have cached dependencies, return them
      if (_calculationDependencies[calculationId]) {
        resolve(_calculationDependencies[calculationId]);
        return;
      }
      
      // Otherwise, need to analyze the calculation
      window.calculationsDB.calculations.get(calculationId)
        .then(calculation => {
          if (!calculation) {
            throw new Error("Calculation not found");
          }
          
          const dependencies = [];
          
          // Check parameters for calculation references
          if (calculation.parameters) {
            calculation.parameters.forEach(param => {
              if (param.type === "calculation" && param.calcReference) {
                dependencies.push(parseInt(param.calcReference));
              }
            });
          }
          
          // Also check the calculation code for references to other calculations
          // This would require parsing the code, which is more complex
          // For simplicity, we'll just use the parameters for now
          
          // Cache and return the dependencies
          _calculationDependencies[calculationId] = dependencies;
          resolve(dependencies);
        })
        .catch(reject);
    });
  }
  
  /**
   * Get all calculations that depend on a specific calculation
   * @param {number} calculationId - The ID of the calculation
   * @returns {Promise} Promise that resolves with an array of dependent calculation IDs
   */
  function getDependentCalculations(calculationId) {
    return new Promise((resolve, reject) => {
      window.calculationsDB.calculations.getAll()
        .then(calculations => {
          const dependentIds = [];
          
          // Check each calculation for dependencies
          calculations.forEach(calc => {
            if (calc.parameters) {
              calc.parameters.some(param => {
                if (param.type === "calculation" && 
                    param.calcReference && 
                    parseInt(param.calcReference) === calculationId) {
                  dependentIds.push(calc.id);
                  return true; // Only need to find one dependency
                }
                return false;
              });
            }
          });
          
          resolve(dependentIds);
        })
        .catch(reject);
    });
  }
  
  /**
   * Check if a calculation's cache is up to date
   * @param {number} calculationId - The ID of the calculation
   * @returns {Promise} Promise that resolves with the cache status
   */
  function checkCacheStatus(calculationId) {
    return new Promise((resolve, reject) => {
      // If there's no cache entry, it's not up to date
      if (!_calculationCache[calculationId]) {
        resolve({ isUpToDate: false });
        return;
      }
      
      // Get dependencies
      getCalculationDependencies(calculationId)
        .then(dependencies => {
          if (dependencies.length === 0) {
            // No dependencies, so cache is up to date
            resolve({ isUpToDate: true });
            return;
          }
          
          // Check each dependency's cache timestamp
          const cacheEntry = _calculationCache[calculationId];
          const cacheTimestamp = new Date(cacheEntry.timestamp);
          
          let allDependenciesUpToDate = true;
          const outdatedDependencies = [];
          
          // Check each dependency
          dependencies.forEach(depId => {
            // If dependency is not in cache, it's not up to date
            if (!_calculationCache[depId]) {
              allDependenciesUpToDate = false;
              outdatedDependencies.push(depId);
            } else {
              // Check if dependency was updated after this calculation's cache
              const depTimestamp = new Date(_calculationCache[depId].timestamp);
              if (depTimestamp > cacheTimestamp) {
                allDependenciesUpToDate = false;
                outdatedDependencies.push(depId);
              }
            }
          });
          
          resolve({
            isUpToDate: allDependenciesUpToDate,
            outdatedDependencies: outdatedDependencies
          });
        })
        .catch(reject);
    });
  }
  
  /**
   * Get a cached calculation result
   * @param {number} calculationId - The ID of the calculation
   * @returns {Object|null} The cached result or null if not cached
   */
  function getCachedResult(calculationId) {
    return _calculationCache[calculationId] || null;
  }
  
  /**
   * Clear the cache for a specific calculation
   * @param {number} calculationId - The ID of the calculation
   */
  function clearCalculationCache(calculationId) {
    if (_calculationCache[calculationId]) {
      delete _calculationCache[calculationId];
    }
  }
  
  /**
   * Clear all calculation caches
   */
  function clearAllCaches() {
    _calculationCache = {};
    _calculationDependencies = {};
  }
  
  /**
   * Add a log entry
   * @param {...*} args - Arguments to log
   */
  function log(...args) {
    const timestamp = new Date().toISOString();
    _executionLog.push({ timestamp, message: args });
    
    // Also log to console in development mode
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log(...args);
    }
  }
  
  /**
   * Get the execution log
   * @returns {Array} The execution log
   */
  function getExecutionLog() {
    return _executionLog;
  }
  
  // Return public API
  return {
    init,
    executeCalculation,
    registerFunction,
    unregisterFunction,
    testFunction,
    getCalculationDependencies,
    getDependentCalculations,
    checkCacheStatus,
    getCachedResult,
    clearCalculationCache,
    clearAllCaches,
    getExecutionLog
  };
})();