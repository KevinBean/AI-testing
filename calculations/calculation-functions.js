/**
 * Predefined utility functions for the Advanced Calculations System
 * These functions can be used in calculations
 */

(function() {
  // Register core utility functions with the calculation engine
  window.addEventListener('DOMContentLoaded', () => {
    // Wait for calculation engine to be available
    const waitForEngine = setInterval(() => {
      if (window.calculationsEngine) {
        clearInterval(waitForEngine);
        registerCoreFunctions();
      }
    }, 100);
  });

  /**
   * Register core utility functions with the calculation engine
   */
  function registerCoreFunctions() {
    // Engineering functions
    registerFunction({
      name: "convertUnit",
      description: "Convert a value from one unit to another",
      params: ["value", "fromUnit", "toUnit"],
      code: `
        // This function converts a value from one unit to another using math.js unit conversion
        try {
          const unitValue = math.unit(value, fromUnit);
          return math.number(math.to(unitValue, toUnit));
        } catch (error) {
          throw new Error(\`Unit conversion error: \${error.message}\`);
        }
      `
    });

    registerFunction({
      name: "roundToSignificantDigits",
      description: "Round a number to a specified number of significant digits",
      params: ["value", "sigDigits"],
      code: `
        // Handle zero and non-numeric values
        if (value === 0 || !isFinite(value)) return value;
        
        // Calculate order of magnitude
        const order = Math.floor(Math.log10(Math.abs(value)));
        
        // Calculate the scale factor
        const scale = Math.pow(10, sigDigits - 1 - order);
        
        // Round the number and restore scale
        return Math.round(value * scale) / scale;
      `
    });

    // Statistical functions
    registerFunction({
      name: "percentile",
      description: "Calculate the percentile value of an array of numbers",
      params: ["data", "percentile"],
      code: `
        // Sort the data first
        const sortedData = [...data].sort((a, b) => a - b);
        const n = sortedData.length;
        
        // Calculate position
        const position = percentile * (n - 1);
        const lowerIndex = Math.floor(position);
        const upperIndex = Math.ceil(position);
        
        // Check for exact match
        if (lowerIndex === upperIndex) {
          return sortedData[lowerIndex];
        }
        
        // Interpolate
        const fraction = position - lowerIndex;
        return sortedData[lowerIndex] + fraction * (sortedData[upperIndex] - sortedData[lowerIndex]);
      `
    });

    registerFunction({
      name: "normalCDF",
      description: "Calculate the cumulative distribution function of the normal distribution",
      params: ["x", "mean", "stdDev"],
      code: `
        // Set defaults if not provided
        mean = mean === undefined ? 0 : mean;
        stdDev = stdDev === undefined ? 1 : stdDev;
        
        // Error function approximation
        function erf(x) {
          // Save the sign of x
          const sign = (x >= 0) ? 1 : -1;
          x = Math.abs(x);
          
          // Constants for approximation
          const a1 =  0.254829592;
          const a2 = -0.284496736;
          const a3 =  1.421413741;
          const a4 = -1.453152027;
          const a5 =  1.061405429;
          const p  =  0.3275911;
          
          // Approximation formula
          const t = 1.0 / (1.0 + p * x);
          const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
          return sign * y;
        }
        
        // Calculate z-score
        const z = (x - mean) / (stdDev * Math.sqrt(2));
        
        // Apply error function
        return 0.5 * (1 + erf(z));
      `
    });

    // Financial functions
    registerFunction({
      name: "pv",
      description: "Calculate the present value of an investment",
      params: ["rate", "nper", "pmt", "fv", "type"],
      code: `
        // Default values
        fv = fv || 0;
        type = type || 0;
        
        // Calculate present value
        let result;
        if (rate === 0) {
          result = -fv - pmt * nper;
        } else {
          const term = Math.pow(1 + rate, nper);
          if (type === 1) {
            result = -fv / term - pmt * (1 + rate) * (term - 1) / (rate * term);
          } else {
            result = -fv / term - pmt * (term - 1) / (rate * term);
          }
        }
        
        return result;
      `
    });

    registerFunction({
      name: "fv",
      description: "Calculate the future value of an investment",
      params: ["rate", "nper", "pmt", "pv", "type"],
      code: `
        // Default values
        pv = pv || 0;
        type = type || 0;
        
        // Calculate future value
        let result;
        if (rate === 0) {
          result = -pv - pmt * nper;
        } else {
          const term = Math.pow(1 + rate, nper);
          if (type === 1) {
            result = -pv * term - pmt * (1 + rate) * (term - 1) / rate;
          } else {
            result = -pv * term - pmt * (term - 1) / rate;
          }
        }
        
        return result;
      `
    });

    registerFunction({
      name: "pmt",
      description: "Calculate the payment for a loan",
      params: ["rate", "nper", "pv", "fv", "type"],
      code: `
        // Default values
        fv = fv || 0;
        type = type || 0;
        
        // Handle zero rate
        if (rate === 0) {
          return -(pv + fv) / nper;
        }
        
        // Calculate payment
        const term = Math.pow(1 + rate, nper);
        let result;
        
        if (type === 1) {
          result = -(pv * rate * term + fv * rate) / ((1 + rate) * (term - 1));
        } else {
          result = -(pv * rate * term + fv * rate) / (term - 1);
        }
        
        return result;
      `
    });

    // Date functions
    registerFunction({
      name: "daysBetween",
      description: "Calculate the number of days between two dates",
      params: ["startDate", "endDate"],
      code: `
        // Convert to Date objects if they are strings
        if (typeof startDate === 'string') {
          startDate = new Date(startDate);
        }
        
        if (typeof endDate === 'string') {
          endDate = new Date(endDate);
        }
        
        // Check for invalid dates
        if (isNaN(startDate) || isNaN(endDate)) {
          throw new Error("Invalid date format");
        }
        
        // Calculate the difference in milliseconds and convert to days
        const diffInMs = endDate - startDate;
        return diffInMs / (1000 * 60 * 60 * 24);
      `
    });

    registerFunction({
      name: "addDays",
      description: "Add a specified number of days to a date",
      params: ["date", "days"],
      code: `
        // Convert to Date object if it is a string
        if (typeof date === 'string') {
          date = new Date(date);
        }
        
        // Check for invalid date
        if (isNaN(date)) {
          throw new Error("Invalid date format");
        }
        
        // Create a new date to avoid modifying the original
        const newDate = new Date(date);
        newDate.setDate(date.getDate() + days);
        
        return newDate;
      `
    });

    // Engineering functions
    registerFunction({
      name: "linearInterpolation",
      description: "Perform linear interpolation between two points",
      params: ["x", "x1", "y1", "x2", "y2"],
      code: `
        // Check for division by zero
        if (x2 - x1 === 0) {
          throw new Error("x1 and x2 cannot be equal (division by zero)");
        }
        
        // Calculate the interpolated value
        return y1 + (x - x1) * (y2 - y1) / (x2 - x1);
      `
    });

    registerFunction({
      name: "interpolateTable",
      description: "Interpolate a value from a lookup table",
      params: ["x", "table"],
      code: `
        // Validate the input table
        if (!Array.isArray(table) || table.length < 2) {
          throw new Error("Table must be an array with at least two points");
        }
        
        // Ensure each point has x and y coordinates
        if (!table.every(point => point.length >= 2)) {
          throw new Error("Each point in the table must have at least x and y coordinates");
        }
        
        // Sort the table by x values
        const sortedTable = [...table].sort((a, b) => a[0] - b[0]);
        
        // Check if x is outside the table range
        if (x < sortedTable[0][0]) {
          return sortedTable[0][1]; // Return the first y value
        }
        
        if (x > sortedTable[sortedTable.length - 1][0]) {
          return sortedTable[sortedTable.length - 1][1]; // Return the last y value
        }
        
        // Find the two points to interpolate between
        for (let i = 0; i < sortedTable.length - 1; i++) {
          if (x >= sortedTable[i][0] && x <= sortedTable[i+1][0]) {
            const x1 = sortedTable[i][0];
            const y1 = sortedTable[i][1];
            const x2 = sortedTable[i+1][0];
            const y2 = sortedTable[i+1][1];
            
            // Use linear interpolation
            return y1 + (x - x1) * (y2 - y1) / (x2 - x1);
          }
        }
        
        // This should not happen, but just in case
        return null;
      `
    });

    // Mechanical engineering functions
    registerFunction({
      name: "beamDeflection",
      description: "Calculate the maximum deflection of a simply supported beam",
      params: ["load", "length", "elasticModulus", "momentOfInertia"],
      code: `
        // Calculate the maximum deflection
        // Formula: delta = (P * L^3) / (48 * E * I)
        // Where:
        // - P is the load (force)
        // - L is the length of the beam
        // - E is the elastic modulus
        // - I is the moment of inertia
        
        return (load * Math.pow(length, 3)) / (48 * elasticModulus * momentOfInertia);
      `
    });
    
    // Electrical engineering functions
    registerFunction({
      name: "voltageDivider",
      description: "Calculate the output voltage in a voltage divider circuit",
      params: ["inputVoltage", "resistor1", "resistor2"],
      code: `
        // Calculate the output voltage
        // Formula: Vout = Vin * (R2 / (R1 + R2))
        
        return inputVoltage * (resistor2 / (resistor1 + resistor2));
      `
    });
    
    // Chemical engineering functions
    registerFunction({
      name: "reynoldsNumber",
      description: "Calculate the Reynolds number for a fluid flow",
      params: ["density", "velocity", "diameter", "viscosity"],
      code: `
        // Calculate the Reynolds number
        // Formula: Re = (rho * v * D) / mu
        // Where:
        // - rho is the fluid density
        // - v is the fluid velocity
        // - D is the characteristic length (e.g., pipe diameter)
        // - mu is the dynamic viscosity
        
        return (density * velocity * diameter) / viscosity;
      `
    });
    
    // Civil engineering functions
    registerFunction({
      name: "beamBendingStress",
      description: "Calculate the maximum bending stress in a beam",
      params: ["moment", "distanceFromNeutralAxis", "momentOfInertia"],
      code: `
        // Calculate the maximum bending stress
        // Formula: sigma = (M * y) / I
        // Where:
        // - M is the bending moment
        // - y is the distance from the neutral axis
        // - I is the moment of inertia
        
        return (moment * distanceFromNeutralAxis) / momentOfInertia;
      `
    });
    
    // Data analysis functions
    registerFunction({
      name: "linearRegression",
      description: "Perform simple linear regression on a set of data points",
      params: ["dataPoints"],
      code: `
        // dataPoints should be an array of [x, y] pairs
        // Check if we have enough data points
        if (!Array.isArray(dataPoints) || dataPoints.length < 2) {
          throw new Error("At least two data points are required for regression");
        }
        
        // Calculate the means of x and y
        let sumX = 0;
        let sumY = 0;
        
        for (let i = 0; i < dataPoints.length; i++) {
          sumX += dataPoints[i][0];
          sumY += dataPoints[i][1];
        }
        
        const meanX = sumX / dataPoints.length;
        const meanY = sumY / dataPoints.length;
        
        // Calculate the slope and y-intercept
        let numerator = 0;
        let denominator = 0;
        
        for (let i = 0; i < dataPoints.length; i++) {
          const x = dataPoints[i][0];
          const y = dataPoints[i][1];
          
          numerator += (x - meanX) * (y - meanY);
          denominator += Math.pow(x - meanX, 2);
        }
        
        // Avoid division by zero
        if (denominator === 0) {
          throw new Error("Cannot perform regression: all x values are identical");
        }
        
        const slope = numerator / denominator;
        const intercept = meanY - slope * meanX;
        
        // Calculate R-squared (coefficient of determination)
        let ssResidual = 0; // Sum of squares of residuals
        let ssTotal = 0;    // Total sum of squares
        
        for (let i = 0; i < dataPoints.length; i++) {
          const x = dataPoints[i][0];
          const y = dataPoints[i][1];
          const predicted = slope * x + intercept;
          
          ssResidual += Math.pow(y - predicted, 2);
          ssTotal += Math.pow(y - meanY, 2);
        }
        
        const rSquared = 1 - (ssResidual / ssTotal);
        
        // Return the regression results
        return {
          slope: slope,
          intercept: intercept,
          rSquared: rSquared,
          predict: function(x) {
            return slope * x + intercept;
          }
        };
      `
    });
    
    // Numerical methods
    registerFunction({
      name: "numericalIntegration",
      description: "Numerically integrate a function using the trapezoidal rule",
      params: ["func", "a", "b", "n"],
      code: `
        // Set a default number of intervals if not provided
        n = n || 100;
        
        // Check that the endpoints are valid
        if (typeof a !== 'number' || typeof b !== 'number') {
          throw new Error("Integration endpoints must be numbers");
        }
        
        // Check that the function is valid
        if (typeof func !== 'function') {
          throw new Error("First argument must be a function");
        }
        
        // Handle reversed limits
        if (b < a) {
          return -numericalIntegration(func, b, a, n);
        }
        
        // Compute the step size
        const h = (b - a) / n;
        
        // Initialize the result with the endpoint contributions
        let result = (func(a) + func(b)) / 2;
        
        // Add the intermediate points
        for (let i = 1; i < n; i++) {
          const x = a + i * h;
          result += func(x);
        }
        
        // Multiply by the step size
        result *= h;
        
        return result;
      `
    });
    
    registerFunction({
      name: "solveEquation",
      description: "Find the root of an equation using the Newton-Raphson method",
      params: ["func", "derivative", "initialGuess", "tolerance", "maxIterations"],
      code: `
        // Set default values for optional parameters
        tolerance = tolerance || 1e-10;
        maxIterations = maxIterations || 100;
        
        // Check that the functions are valid
        if (typeof func !== 'function' || typeof derivative !== 'function') {
          throw new Error("First two arguments must be functions");
        }
        
        // Newton-Raphson method
        let x = initialGuess;
        let fx = func(x);
        
        for (let i = 0; i < maxIterations; i++) {
          // Check if we're close enough to a root
          if (Math.abs(fx) < tolerance) {
            return x;
          }
          
          // Calculate the derivative
          const dfx = derivative(x);
          
          // Avoid division by zero
          if (dfx === 0) {
            throw new Error("Derivative is zero. Newton's method failed.");
          }
          
          // Update x using Newton's formula
          const xNew = x - fx / dfx;
          
          // Check for convergence
          if (Math.abs(xNew - x) < tolerance) {
            return xNew;
          }
          
          x = xNew;
          fx = func(x);
        }
        
        // If we get here, the method didn't converge
        throw new Error(\`Newton's method failed to converge after \${maxIterations} iterations\`);
      `
    });
    
    // Array and matrix functions
    registerFunction({
      name: "transpose",
      description: "Transpose a matrix (2D array)",
      params: ["matrix"],
      code: `
        // Check that the input is a valid matrix
        if (!Array.isArray(matrix) || matrix.length === 0 || !Array.isArray(matrix[0])) {
          throw new Error("Input must be a non-empty 2D array (matrix)");
        }
        
        const rows = matrix.length;
        const cols = matrix[0].length;
        
        // Initialize the result matrix
        const result = [];
        for (let j = 0; j < cols; j++) {
          result[j] = [];
          for (let i = 0; i < rows; i++) {
            result[j][i] = matrix[i][j];
          }
        }
        
        return result;
      `
    });
    
    // Probability functions
    registerFunction({
      name: "binomialCoefficient",
      description: "Calculate the binomial coefficient (n choose k)",
      params: ["n", "k"],
      code: `
        // Handle edge cases
        if (k < 0 || k > n) {
          return 0;
        }
        
        if (k === 0 || k === n) {
          return 1;
        }
        
        // For small values, calculate directly
        if (k === 1 || k === n - 1) {
          return n;
        }
        
        // For efficiency, use the symmetry of binomial coefficients
        k = Math.min(k, n - k);
        
        // Calculate using the multiplicative formula
        let result = 1;
        for (let i = 1; i <= k; i++) {
          result *= (n - (k - i));
          result /= i;
        }
        
        return Math.round(result);
      `
    });
    
    registerFunction({
      name: "factorial",
      description: "Calculate the factorial of a non-negative integer",
      params: ["n"],
      code: `
        // Check for negative input
        if (n < 0) {
          throw new Error("Factorial is not defined for negative numbers");
        }
        
        // Handle special cases
        if (n === 0 || n === 1) {
          return 1;
        }
        
        // Calculate factorial
        let result = 1;
        for (let i = 2; i <= n; i++) {
          result *= i;
        }
        
        return result;
      `
    });
  }

  /**
   * Register a function with the calculation engine
   * @param {Object} functionDef - Function definition object
   */
  function registerFunction(functionDef) {
    // Only register if the engine is available
    if (window.calculationsEngine && typeof window.calculationsEngine.registerFunction === 'function') {
      window.calculationsEngine.registerFunction(functionDef);
    } else {
      console.warn(`Could not register function ${functionDef.name}: Calculation engine not available.`);
    }
  }
})();