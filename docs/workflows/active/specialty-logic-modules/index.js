/**
 * SwiftList Specialty Logic Modules - Central Export
 *
 * Usage in n8n workflows:
 * const SpecialtyLogic = require('./specialty-logic-modules/index.js');
 * const config = SpecialtyLogic.getConfig(specialtyEngine, 'backgroundRemoval', imageUrl);
 */

const JewelrySpecialty = require('./JewelrySpecialty');
const FashionSpecialty = require('./FashionSpecialty');
const GlassSpecialty = require('./GlassSpecialty');
const FurnitureSpecialty = require('./FurnitureSpecialty');
const GeneralSpecialty = require('./GeneralSpecialty');

const SPECIALTY_MODULES = {
  'WF-02': JewelrySpecialty,
  'WF-03': FashionSpecialty,
  'WF-04': GlassSpecialty,
  'WF-05': FurnitureSpecialty,
  'WF-06': GeneralSpecialty
};

module.exports = {

  /**
   * Get specialty configuration for a given workflow operation
   *
   * @param {string} specialtyEngine - The specialty engine tag (WF-02, WF-03, etc.)
   * @param {string} operation - The operation name (backgroundRemoval, upscale, etc.)
   * @param {...any} args - Arguments to pass to the specialty function
   * @returns {object} Configuration object for the operation
   *
   * @example
   * // In n8n workflow WF-07 (Background Removal)
   * const jobMetadata = $json; // Contains specialty_engine: "WF-02"
   * const SpecialtyLogic = require('./specialty-logic-modules/index.js');
   * const config = SpecialtyLogic.getConfig(
   *   jobMetadata.specialty_engine,
   *   'backgroundRemoval',
   *   jobMetadata.current_image_url
   * );
   * // Returns jewelry-specific background removal config
   */
  getConfig(specialtyEngine, operation, ...args) {
    // Default to general if no specialty engine specified
    const module = SPECIALTY_MODULES[specialtyEngine] || GeneralSpecialty;

    // Check if the operation exists in the specialty module
    if (typeof module[operation] !== 'function') {
      throw new Error(`Operation '${operation}' not found in specialty module for ${specialtyEngine}`);
    }

    // Call the specialty function with provided arguments
    return module[operation](...args);
  },

  /**
   * Check if a workflow requires specialty logic
   *
   * @param {string} workflowId - The workflow ID (WF-07, WF-16, etc.)
   * @returns {boolean} True if workflow supports specialty logic
   */
  workflowSupportsSpecialtyLogic(workflowId) {
    const SPECIALTY_AWARE_WORKFLOWS = [
      'WF-07', // Background Removal
      'WF-08', // Simplify BG
      'WF-09', // Lifestyle Setting
      'WF-10', // Product Description
      'WF-14', // High-Res Upscale
      'WF-15', // Color Variants
      'WF-16', // 360° Spin
      'WF-18', // Animation
      'WF-19', // Product Collage
      'WF-21', // AI Model Swap
      'WF-25'  // Marketplace Compliance
    ];

    return SPECIALTY_AWARE_WORKFLOWS.includes(workflowId);
  },

  /**
   * Get the specialty module directly
   *
   * @param {string} specialtyEngine - The specialty engine tag (WF-02, WF-03, etc.)
   * @returns {object} The specialty module
   */
  getModule(specialtyEngine) {
    return SPECIALTY_MODULES[specialtyEngine] || GeneralSpecialty;
  },

  // Export individual modules for direct access
  JewelrySpecialty,
  FashionSpecialty,
  GlassSpecialty,
  FurnitureSpecialty,
  GeneralSpecialty
};
