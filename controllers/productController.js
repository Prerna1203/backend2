const db = require('../config/database');

const productController = {
    // Create a new product
    async create(req, res) {
        let connection;
        try {
            connection = await db.getConnection();
            await connection.beginTransaction();

            let {
                name,
                slug,
                shortDescription,
                description,
                price,
                stockQuantity,
                categoryId,
                subcategoryId,
                subSubcategoryId,
                selectedAttributes
            } = req.body;
            // Ensure selectedAttributes is an array or empty array
            const attributesArray = selectedAttributes ? JSON.parse(selectedAttributes) : [];


            // Process uploaded images
            const images = req.files.map(file => file.path);

            // Insert product into the products table


            const [productResult] = await connection.execute(
                `INSERT INTO products 
                (name, slug, short_description, description, price, stock_quantity, category_id, subcategory_id, sub_subcategory_id, attribute) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, // ✅ Now matches 9 values
                [name || null, slug || null, shortDescription || null, description || null,
                price || 0, stockQuantity || 0, categoryId || null, subcategoryId || null, subSubcategoryId || null, selectedAttributes || null] // ✅ Correct count
            );

            const productId = productResult.insertId;

            if (typeof selectedAttributes === "string") {
                selectedAttributes = selectedAttributes.split(",").map(attr => attr.trim());
            }


            // Insert product attributes into the product_attributes table
            if (Array.isArray(selectedAttributes) && selectedAttributes.length > 0) {
                // Convert attribute values (e.g., 'Green', 'Large') to IDs
                const [attributeRows] = await connection.query(
                    `SELECT id, value FROM attributes WHERE value IN (?)`,
                    [selectedAttributes]
                );

                // Create mapping of values to their IDs
                const attributeMap = {};
                attributeRows.forEach(row => {
                    attributeMap[row.value] = row.id;
                });

                // Map selected attribute values to their corresponding IDs
                const attributeValues = selectedAttributes
                    .map(attrValue => attributeMap[attrValue])  // Convert to ID
                    .filter(attrId => attrId); // Remove undefined values

                // Insert only if valid IDs exist
                if (attributeValues.length > 0) {
                    const attributeInsertValues = attributeValues.map(attrId => [productId, attrId]);
                    await connection.query(
                        'INSERT INTO product_attributes (product_id, attribute_id) VALUES ?',
                        [attributeInsertValues]
                    );
                }
            }


            // Insert product images into the product_images table
            if (images && images.length > 0) {
                const imageValues = images.map(imageUrl => [productId, imageUrl]);
                await connection.query(
                    'INSERT INTO product_images (product_id, image_url) VALUES ?',
                    [imageValues]
                );
            }

            await connection.commit();

            res.status(201).json({
                success: true,
                message: 'Product added successfully',
                data: { productId }
            });

        } catch (error) {
            if (connection) await connection.rollback();
            console.error('Error adding product:', error);
            res.status(500).json({
                success: false,
                message: 'Error adding product',
                error: error.message
            });
        } finally {
            if (connection) connection.release();
        }
    },

    //Get all products
    // async getAll(req, res) {
    //     try {
    //         const [products] = await db.execute('SELECT * FROM products');
    //         res.status(200).json({
    //             success: true,
    //             data: products
    //         });
    //     } catch (error) {
    //         console.error('Error fetching products:', error);
    //         res.status(500).json({
    //             success: false,
    //             message: 'Error fetching products',
    //             error: error.message
    //         });
    //     }
    // },

    async getAll(req, res) {
        try {
            // Fetch products along with the category name
            const [products] = await db.execute(`
                SELECT 
                    p.id, 
                    p.name, 
                    p.slug, 
                    p.short_description, 
                    p.description, 
                    p.price, 
                    p.stock_quantity, 
                     DATE(p.created_at) AS created_at,
                    p.category_id, 
                    c.name AS category_name
                    GROUP_CONCAT(pi.image_url) AS images
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN product_images pi ON p.id = pi.product_id
            GROUP BY p.id
            `);



            const formattedProducts = products.map(product => ({
                ...product,
                images: product.images ? product.images.split(',') : []
            }));

            res.status(200).json({
                success: true,
                data: formattedProducts
            });
        } catch (error) {
            console.error('Error fetching products:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching products',
                error: error.message
            });
        }
    },






    // Get a single product by ID
    async getById(req, res) {
        let connection;
        try {
            connection = await db.getConnection();

            // Validate product ID
            const productId = parseInt(req.params.id);
            if (isNaN(productId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid product ID'
                });
            }

            // Get product details with category name and images
            const [products] = await connection.execute(`
                SELECT 
                    p.*,
                    c.name AS category_name,
                    GROUP_CONCAT(pi.image_url) AS images
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN product_images pi ON p.id = pi.product_id
                WHERE p.id = ?
                GROUP BY p.id
            `, [productId]);

            if (products.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Product not found'
                });
            }

            // Convert images string to array and format the response
            const productData = {
                ...products[0],
                images: products[0].images ? products[0].images.split(',') : [],
                price: parseFloat(products[0].price) // Ensure price is a number
            };

            res.status(200).json({
                success: true,
                data: productData
            });

        } catch (error) {
            console.error('Error fetching product:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching product',
                error: error.message
            });
        } finally {
            if (connection) connection.release();
        }
    }
};


module.exports = productController;