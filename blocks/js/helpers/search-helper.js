/**
 * SearchHelper - Advanced search functionality for Markdown Note System
 * Provides unified search capabilities with syntax-based search (Boolean operators, phrase matching),
 * multi-field search with different weights, and full-text search across all content types.
 */

const SearchHelper = (function() {
  // Private properties
  const FIELD_WEIGHTS = {
    title: 10,     // Title matches are most important
    content: 5,    // Content matches are very important
    tags: 8,       // Tag matches are quite important
    reference: 3,  // Reference matches are somewhat important
    notes: 2       // Notes matches are least important
  };
  
  // Boolean operator constants
  const OPERATORS = {
    AND: 'AND',
    OR: 'OR',
    NOT: 'NOT'
  };
  
  /**
   * Parse a search query into tokens and operators
   * Supports: 
   * - Phrase matching with quotes: "exact phrase"
   * - Boolean operators: AND, OR, NOT
   * - Field-specific search: title:term, content:term, tags:term
   * 
   * @param {string} query - The search query to parse
   * @returns {Object} - Parsed query with tokens and operators
   */
  function parseQuery(query) {
    if (!query || typeof query !== 'string') {
      return { tokens: [], operator: OPERATORS.OR };
    }
    
    // Default operator is OR unless AND is explicitly specified
    let defaultOperator = query.includes(' AND ') ? OPERATORS.AND : OPERATORS.OR;
    
    // Extract phrases (text within quotes)
    const phrases = [];
    const phraseRegex = /"([^"]*)"/g;
    let phraseMatch;
    let processedQuery = query;
    
    while ((phraseMatch = phraseRegex.exec(query)) !== null) {
      phrases.push(phraseMatch[1]);
      // Replace the phrase with a placeholder to preserve the rest of the query
      processedQuery = processedQuery.replace(phraseMatch[0], `__PHRASE${phrases.length - 1}__`);
    }
    
    // Split the query by spaces, respecting boolean operators
    let parts = processedQuery.split(' ').filter(part => part.trim());
    
    // Process each part to extract field specifiers and handle boolean operators
    const tokens = [];
    let currentOperator = defaultOperator;
    
    for (let i = 0; i < parts.length; i++) {
      let part = parts[i].trim();
      
      // Skip if empty
      if (!part) continue;
      
      // Handle phrase placeholders
      if (part.startsWith('__PHRASE') && part.endsWith('__')) {
        const phraseIndex = parseInt(part.replace('__PHRASE', '').replace('__', ''));
        if (!isNaN(phraseIndex) && phrases[phraseIndex]) {
          tokens.push({
            type: 'phrase',
            value: phrases[phraseIndex],
            operator: currentOperator
          });
          currentOperator = defaultOperator; // Reset to default for next token
        }
        continue;
      }
      
      // Handle boolean operators
      if (part.toUpperCase() === OPERATORS.AND) {
        currentOperator = OPERATORS.AND;
        continue;
      } else if (part.toUpperCase() === OPERATORS.OR) {
        currentOperator = OPERATORS.OR;
        continue;
      } else if (part.toUpperCase() === OPERATORS.NOT || part === '-') {
        currentOperator = OPERATORS.NOT;
        continue;
      }
      
      // Handle field specifiers (field:term)
      let field = null;
      let value = part;
      
      if (part.includes(':')) {
        const [fieldName, ...valueParts] = part.split(':');
        field = fieldName.toLowerCase();
        value = valueParts.join(':');
      }
      
      // Add the token with its associated operator
      tokens.push({
        type: 'term',
        value: value,
        field: field,
        operator: currentOperator
      });
      
      // Reset to default operator for next token
      currentOperator = defaultOperator;
    }
    
    return {
      tokens: tokens,
      operator: defaultOperator
    };
  }
  
  /**
   * Calculate match score for an item against search tokens
   * @param {Object} item - Item to score
   * @param {Array} tokens - Search tokens
   * @param {Object} fieldMappings - How to access fields in the item
   * @returns {number} - Match score (higher is better match)
   */
  function calculateScore(item, tokens, fieldMappings) {
    if (!item || !tokens || !tokens.length) return 0;
    
    let score = 0;
    let hasRequiredMatch = false;
    let hasExcludedMatch = false;
    
    // Process each token
    tokens.forEach(token => {
      // Check for field-specific search
      let fieldValues = [];
      
      if (token.field && fieldMappings[token.field]) {
        // Get the value for the specific field
        const fieldValue = fieldMappings[token.field](item);
        if (fieldValue) {
          fieldValues.push({
            value: fieldValue,
            weight: FIELD_WEIGHTS[token.field] || 1
          });
        }
      } else {
        // Check all fields if no specific field is mentioned
        Object.keys(fieldMappings).forEach(field => {
          const fieldValue = fieldMappings[field](item);
          if (fieldValue) {
            fieldValues.push({
              value: fieldValue,
              weight: FIELD_WEIGHTS[field] || 1
            });
          }
        });
      }
      
      // For each field, calculate match
      let tokenScore = 0;
      let foundInAnyField = false;
      
      fieldValues.forEach(field => {
        const fieldValue = String(field.value).toLowerCase();
        const tokenValue = token.value.toLowerCase();
        
        let fieldScore = 0;
        
        // For phrase types, look for exact match
        if (token.type === 'phrase') {
          if (fieldValue.includes(tokenValue)) {
            fieldScore = field.weight * 2; // Bonus for exact phrase match
            foundInAnyField = true;
          }
        } else {
          // For term types, check if the term is in the field
          if (fieldValue.includes(tokenValue)) {
            // Exact word match gets higher score than partial match
            const wordMatch = new RegExp(`\\b${tokenValue}\\b`, 'i').test(fieldValue);
            fieldScore = field.weight * (wordMatch ? 1.5 : 1);
            foundInAnyField = true;
          }
        }
        
        tokenScore += fieldScore;
      });
      
      // Apply boolean logic
      if (token.operator === OPERATORS.AND && !foundInAnyField) {
        hasRequiredMatch = false;
      } else if (token.operator === OPERATORS.NOT && foundInAnyField) {
        hasExcludedMatch = true;
      } else if (foundInAnyField) {
        if (token.operator === OPERATORS.AND) {
          hasRequiredMatch = true;
        }
        score += tokenScore;
      }
    });
    
    // Apply boolean logic to final score
    const parsedQuery = parseQuery();
    if (parsedQuery.operator === OPERATORS.AND && !hasRequiredMatch) {
      return 0;
    }
    
    if (hasExcludedMatch) {
      return 0;
    }
    
    return score;
  }
  
  /**
   * Search blocks with scored results
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Scored search results
   */
  async function searchBlocks(query) {
    if (!db) {
      throw new Error("Database not initialized");
    }
    
    const parsedQuery = parseQuery(query);
    if (!parsedQuery.tokens.length) {
      return [];
    }
    
    return new Promise((resolve, reject) => {
      const results = [];
      
      try {
        const transaction = db.transaction("blocks", "readonly");
        const store = transaction.objectStore("blocks");
        
        store.openCursor().onsuccess = function(e) {
          const cursor = e.target.result;
          if (cursor) {
            const block = cursor.value;
            
            // Define field mappings for blocks
            const fieldMappings = {
              title: (item) => item.title || `Block ${item.id}`,
              content: (item) => item.text,
              tags: (item) => item.tags ? item.tags.join(' ') : '',
              reference: (item) => item.reference || '',
              notes: (item) => item.notes || ''
            };
            
            // Calculate score
            const score = calculateScore(block, parsedQuery.tokens, fieldMappings);
            
            if (score > 0) {
              results.push({
                item: block,
                score: score,
                type: 'block'
              });
            }
            
            cursor.continue();
          } else {
            // Sort by score (highest first)
            results.sort((a, b) => b.score - a.score);
            resolve(results);
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }
  
  /**
   * Search documents with scored results
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Scored search results
   */
  async function searchDocuments(query) {
    if (!db) {
      throw new Error("Database not initialized");
    }
    
    const parsedQuery = parseQuery(query);
    if (!parsedQuery.tokens.length) {
      return [];
    }
    
    return new Promise((resolve, reject) => {
      const results = [];
      
      try {
        const transaction = db.transaction("documents", "readonly");
        const store = transaction.objectStore("documents");
        
        store.openCursor().onsuccess = function(e) {
          const cursor = e.target.result;
          if (cursor) {
            const doc = cursor.value;
            
            // Define field mappings for documents
            const fieldMappings = {
              title: (item) => item.title,
              content: (item) => {
                // Combine all paragraph content
                if (item.combinedContent) {
                  return item.combinedContent;
                }
                
                let content = '';
                if (item.paragraphs && item.paragraphs.length) {
                  content = item.paragraphs.map(p => p.content || '').join(' ');
                }
                return content;
              },
              tags: (item) => {
                // Combine all paragraph tags
                let tags = [];
                if (item.paragraphs && item.paragraphs.length) {
                  item.paragraphs.forEach(p => {
                    if (p.tags && p.tags.length) {
                      tags = tags.concat(p.tags);
                    }
                  });
                }
                return tags.join(' ');
              }
            };
            
            // Calculate score
            const score = calculateScore(doc, parsedQuery.tokens, fieldMappings);
            
            if (score > 0) {
              results.push({
                item: doc,
                score: score,
                type: 'document'
              });
            }
            
            cursor.continue();
          } else {
            // Sort by score (highest first)
            results.sort((a, b) => b.score - a.score);
            resolve(results);
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }
  
  /**
   * Search references with scored results
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Scored search results
   */
  async function searchReferences(query) {
    if (!db) {
      throw new Error("Database not initialized");
    }
    
    const parsedQuery = parseQuery(query);
    if (!parsedQuery.tokens.length) {
      return [];
    }
    
    return new Promise((resolve, reject) => {
      const results = [];
      
      try {
        const transaction = db.transaction("references", "readonly");
        const store = transaction.objectStore("references");
        
        store.openCursor().onsuccess = function(e) {
          const cursor = e.target.result;
          if (cursor) {
            const reference = cursor.value;
            
            // Define field mappings for references
            const fieldMappings = {
              title: (item) => item.name,
              content: (item) => item.description || '',
              reference: (item) => item.id || '',
              tags: (item) => item.type || '',
              notes: (item) => `${item.author || ''} ${item.year || ''} ${item.version || ''}`
            };
            
            // Calculate score
            const score = calculateScore(reference, parsedQuery.tokens, fieldMappings);
            
            if (score > 0) {
              results.push({
                item: reference,
                score: score,
                type: 'reference'
              });
            }
            
            cursor.continue();
          } else {
            // Sort by score (highest first)
            results.sort((a, b) => b.score - a.score);
            resolve(results);
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }
  
  /**
   * Search for content with a specific tag
   * @param {string} tag - Tag to search for
   * @returns {Promise<Object>} - Object with blocks and documents that have the tag
   */
  async function searchByTag(tag) {
    if (!db || !tag) {
      return { blocks: [], documents: [] };
    }
    
    const tagLower = tag.toLowerCase();
    
    return new Promise((resolve, reject) => {
      const results = {
        blocks: [],
        documents: []
      };
      
      let blocksDone = false;
      let documentsDone = false;
      
      try {
        // Search blocks with the tag
        const blockTx = db.transaction("blocks", "readonly");
        const blockStore = blockTx.objectStore("blocks");
        
        blockStore.openCursor().onsuccess = function(e) {
          const cursor = e.target.result;
          if (cursor) {
            const block = cursor.value;
            if (block.tags && block.tags.some(t => t.toLowerCase().includes(tagLower))) {
              results.blocks.push({
                item: block,
                score: 10, // All tag matches get the same score
                type: 'block'
              });
            }
            cursor.continue();
          } else {
            blocksDone = true;
            if (documentsDone) {
              resolve(results);
            }
          }
        };
        
        // Search documents with the tag
        const docTx = db.transaction("documents", "readonly");
        const docStore = docTx.objectStore("documents");
        
        docStore.openCursor().onsuccess = function(e) {
          const cursor = e.target.result;
          if (cursor) {
            const doc = cursor.value;
            if (doc.paragraphs) {
              let hasTag = false;
              for (const para of doc.paragraphs) {
                if (para.tags && para.tags.some(t => t.toLowerCase().includes(tagLower))) {
                  hasTag = true;
                  break;
                }
              }
              
              if (hasTag) {
                results.documents.push({
                  item: doc,
                  score: 10, // All tag matches get the same score
                  type: 'document'
                });
              }
            }
            cursor.continue();
          } else {
            documentsDone = true;
            if (blocksDone) {
              resolve(results);
            }
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }
  
  /**
   * Highlight search terms in text
   * @param {string} text - Original text
   * @param {string} query - Search query
   * @param {number} contextSize - Context size around matches (in characters)
   * @returns {string} - HTML with highlighted matches
   */
  function highlightMatches(text, query, contextSize = 100) {
    if (!text || !query) return text;
    
    const parsedQuery = parseQuery(query);
    if (!parsedQuery.tokens.length) return text;
    
    // Extract terms to highlight
    const terms = parsedQuery.tokens
      .filter(token => token.operator !== OPERATORS.NOT) // Don't highlight NOT terms
      .map(token => token.value.toLowerCase());
    
    // For phrase matching
    const phrases = parsedQuery.tokens
      .filter(token => token.type === 'phrase')
      .map(token => token.value.toLowerCase());
    
    // For term matching
    const singleTerms = parsedQuery.tokens
      .filter(token => token.type === 'term')
      .map(token => token.value.toLowerCase());
    
    // First, check if any term is in the text at all
    let textLower = text.toLowerCase();
    let anyTermMatch = terms.some(term => textLower.includes(term));
    
    if (!anyTermMatch) {
      // If no matches, return original text
      return text;
    }
    
    // Find best match position for context
    let bestPosition = 0;
    let bestTerm = '';
    
    // Prioritize phrase matches
    for (const phrase of phrases) {
      const position = textLower.indexOf(phrase);
      if (position !== -1) {
        bestPosition = position;
        bestTerm = phrase;
        break;
      }
    }
    
    // If no phrase match, use first term match
    if (!bestTerm) {
      for (const term of singleTerms) {
        const position = textLower.indexOf(term);
        if (position !== -1) {
          bestPosition = position;
          bestTerm = term;
          break;
        }
      }
    }
    
    // Get context around the best match
    let startPos = Math.max(0, bestPosition - contextSize);
    let endPos = Math.min(text.length, bestPosition + bestTerm.length + contextSize);
    let extractedText = text.substring(startPos, endPos);
    
    // Add ellipses if context is truncated
    if (startPos > 0) extractedText = '...' + extractedText;
    if (endPos < text.length) extractedText = extractedText + '...';
    
    // Highlight all matching terms and phrases
    terms.forEach(term => {
      const escapeRegExp = (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      };
      
      const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
      extractedText = extractedText.replace(regex, '<mark>$1</mark>');
    });
    
    return extractedText;
  }
  
  /**
   * Universal search across all content types
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} - Search results
   */
  async function universalSearch(query, options = {}) {
    const {
      scope = 'all',
      limit = 20,
      includeContent = true,
      contextSize = 100
    } = options;
    
    if (!query) {
      return {
        blocks: [],
        documents: [],
        references: [],
        tags: { blocks: [], documents: [] }
      };
    }
    
    const results = {};
    const promises = [];
    
    // Determine which content types to search
    if (scope === 'all' || scope === 'blocks') {
      promises.push(searchBlocks(query).then(items => {
        results.blocks = items.slice(0, limit).map(result => {
          if (includeContent) {
            return {
              ...result,
              highlightedContent: highlightMatches(result.item.text, query, contextSize)
            };
          }
          return result;
        });
      }));
    }
    
    if (scope === 'all' || scope === 'documents') {
      promises.push(searchDocuments(query).then(items => {
        results.documents = items.slice(0, limit).map(result => {
          const doc = result.item;
          if (includeContent) {
            // Find best matching paragraph
            let bestMatch = '';
            let bestScore = 0;
            
            if (doc.paragraphs && doc.paragraphs.length) {
              const parsedQuery = parseQuery(query);
              
              doc.paragraphs.forEach(para => {
                // Define field mappings for paragraph
                const fieldMappings = {
                  content: () => para.content || '',
                  tags: () => para.tags ? para.tags.join(' ') : ''
                };
                
                const paraScore = calculateScore(para, parsedQuery.tokens, fieldMappings);
                if (paraScore > bestScore) {
                  bestScore = paraScore;
                  bestMatch = para.content;
                }
              });
            }
            
            return {
              ...result,
              highlightedContent: highlightMatches(bestMatch || doc.combinedContent || '', query, contextSize)
            };
          }
          return result;
        });
      }));
    }
    
    if (scope === 'all' || scope === 'references') {
      promises.push(searchReferences(query).then(items => {
        results.references = items.slice(0, limit).map(result => {
          if (includeContent) {
            return {
              ...result,
              highlightedContent: highlightMatches(result.item.description || '', query, contextSize)
            };
          }
          return result;
        });
      }));
    }
    
    // For tag search, we'll look for tags that contain the query terms
    if (scope === 'all' || scope === 'tags') {
      // Extract tag queries
      const parsedQuery = parseQuery(query);
      const potentialTags = parsedQuery.tokens
        .filter(token => token.operator !== OPERATORS.NOT) // Exclude NOT terms
        .map(token => token.value.toLowerCase());
      
      const tagPromises = [];
      
      for (const tag of potentialTags) {
        tagPromises.push(searchByTag(tag));
      }
      
      promises.push(Promise.all(tagPromises).then(tagResults => {
        // Combine tag results
        const combinedTags = {
          blocks: [],
          documents: []
        };
        
        tagResults.forEach(tagResult => {
          // Merge block results, avoiding duplicates
          tagResult.blocks.forEach(block => {
            if (!combinedTags.blocks.some(b => b.item.id === block.item.id)) {
              combinedTags.blocks.push(block);
            }
          });
          
          // Merge document results, avoiding duplicates
          tagResult.documents.forEach(doc => {
            if (!combinedTags.documents.some(d => d.item.id === doc.item.id)) {
              combinedTags.documents.push(doc);
            }
          });
        });
        
        results.tags = {
          blocks: combinedTags.blocks.slice(0, limit).map(result => {
            if (includeContent) {
              return {
                ...result,
                highlightedContent: highlightMatches(result.item.text, query, contextSize)
              };
            }
            return result;
          }),
          documents: combinedTags.documents.slice(0, limit).map(result => {
            if (includeContent) {
              return {
                ...result,
                highlightedContent: highlightMatches(
                  result.item.combinedContent || 
                  (result.item.paragraphs && result.item.paragraphs.length ? 
                    result.item.paragraphs[0].content : ''),
                  query, 
                  contextSize
                )
              };
            }
            return result;
          })
        };
      }));
    }
    
    await Promise.all(promises);
    return results;
  }
  
  /**
   * Get search suggestions based on partial query
   * @param {string} partialQuery - Partial search query
   * @returns {Promise<Array>} - Search suggestions
   */
  async function getSearchSuggestions(partialQuery) {
    if (!partialQuery || partialQuery.length < 2) {
      return [];
    }
    
    const suggestions = new Set();
    const partialLower = partialQuery.toLowerCase();
    
    // Add tag suggestions
    try {
      const transaction = db.transaction("blocks", "readonly");
      const store = transaction.objectStore("blocks");
      
      store.openCursor().onsuccess = function(e) {
        const cursor = e.target.result;
        if (cursor) {
          const block = cursor.value;
          
          // Add tag suggestions
          if (block.tags && block.tags.length) {
            block.tags.forEach(tag => {
              if (tag.toLowerCase().includes(partialLower)) {
                suggestions.add(`tags:${tag}`);
              }
            });
          }
          
          // Add title suggestions
          if (block.title && block.title.toLowerCase().includes(partialLower)) {
            suggestions.add(`title:${block.title}`);
          }
          
          // Add reference suggestions
          if (block.reference && block.reference.toLowerCase().includes(partialLower)) {
            suggestions.add(`reference:${block.reference}`);
          }
          
          cursor.continue();
        }
      };
    } catch (err) {
      console.error("Error getting search suggestions:", err);
    }
    
    // Return an array of suggestions (limit to 10)
    return Array.from(suggestions).slice(0, 10);
  }
  
  // Public API
  return {
    /**
     * Perform a universal search across all content types
     * @param {string} query - The search query
     * @param {Object} options - Search options
     * @returns {Promise<Object>} - Search results for all content types
     */
    search: universalSearch,
    
    /**
     * Search blocks specifically
     * @param {string} query - The search query
     * @returns {Promise<Array>} - Block search results
     */
    searchBlocks: searchBlocks,
    
    /**
     * Search documents specifically
     * @param {string} query - The search query
     * @returns {Promise<Array>} - Document search results
     */
    searchDocuments: searchDocuments,
    
    /**
     * Search references specifically
     * @param {string} query - The search query
     * @returns {Promise<Array>} - Reference search results
     */
    searchReferences: searchReferences,
    
    /**
     * Search for items with a specific tag
     * @param {string} tag - Tag to search for
     * @returns {Promise<Object>} - Tag search results
     */
    searchByTag: searchByTag,
    
    /**
     * Highlight search terms in text
     * @param {string} text - Text to highlight terms in
     * @param {string} query - Search query
     * @param {number} contextSize - Context size around matches
     * @returns {string} - Highlighted text
     */
    highlightMatches: highlightMatches,
    
    /**
     * Parse a search query into tokens and operators
     * @param {string} query - Search query to parse
     * @returns {Object} - Parsed query structure
     */
    parseQuery: parseQuery,
    
    /**
     * Get search suggestions based on partial query
     * @param {string} partialQuery - Partial search query
     * @returns {Promise<Array>} - Search suggestions
     */
    getSuggestions: getSearchSuggestions
  };
})();
