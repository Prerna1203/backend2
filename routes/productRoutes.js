const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const upload = require('../config/multer'); // Configure multer

// Product routes
router.get('/products', productController.getAll);
router.get('/products/:id', productController.getById);
router.get('/products/top-trending', productController.getTopTrending);
router.post('/products', upload.array('images'), productController.create);
router.delete('/products/:id', productController.deleteProduct);
router.put('/products/:id', upload.array('images'), productController.updateProduct);

module.exports = router;