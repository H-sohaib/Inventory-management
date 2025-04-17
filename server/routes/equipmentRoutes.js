const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware'); // Import the upload middleware
const {
  getAllEquipment,
  getEquipmentById,
  createEquipment,
  updateEquipment,
  updateEquipmentStatus, // Add the new handler
  deleteEquipment,
  getStockableEquipment,
  getSoloEquipment,
  updateEquipmentState // Add the new handler
} = require('../controllers/equipmentController');

// Routes for specific equipment types
router.get('/stockable', getStockableEquipment);
router.get('/solo', getSoloEquipment);

// Main equipment routes
router.get('/', getAllEquipment);

// Single POST route with image upload - remove the duplicate route
router.post('/', upload.single('image'), createEquipment);

router.route('/:id')
  .get(getEquipmentById)
  .put(upload.single('image'), updateEquipment) // Add upload middleware here too
  .patch(updateEquipmentStatus)
  .delete(deleteEquipment);

// Make sure this route exists
router.patch('/:id/state', updateEquipmentState);

module.exports = router;