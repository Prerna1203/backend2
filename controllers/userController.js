const bcrypt = require('bcryptjs');
const { insertUser, insertStudent, insertSchool, insertSE } = require('../models/users');
const db = require('../config/db');

const registerUser = async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    mobile,
    otp,
    password,
    userType,
    schoolName,
    pinCode,
    city,
    state,
    address,
    employeeId // This will come from the dropdown
  } = req.body;

  try {
    console.log('Registering user with data:', { userType, firstName, lastName });

    const hashedPassword = await bcrypt.hash(password, 10);
    const [userResult] = await insertUser([firstName, lastName, email, mobile, otp, hashedPassword, userType]);
    const userId = userResult.insertId;

    if (userType === 'student') {
      await insertStudent(userId, schoolName);
    } else if (userType === 'school') {
      // Pass employeeId directly to insertSchool
      const [schoolResult] = await insertSchool(userId, schoolName, pinCode, city, state, address, employeeId);
    } else if (userType === 'se') {
      await insertSE(userId, employeeId);
    }

    res.status(200).json({ message: 'User registered successfully!' });
  } catch (error) {
    console.error('Error in registerUser:', error);
    res.status(500).json({ error: 'An error occurred while registering the user.' });
  }
};

 
// const fetchSEEmployees = async (req, res) => {
//   try {
//     const [results] = await db.promise().query('SELECT employee_id FROM se_employees');
//     res.status(200).json(results);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Failed to fetch SE Employee IDs' });
//   }
// };

const fetchSchools = async (req, res) => {
  try {
    const [results] = await db.promise().query('SELECT school_name FROM schools');
    res.status(200).json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch school names' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const [users] = await db.promise().query(`
      SELECT 
        u.id,
        CONCAT(u.first_name, ' ', u.last_name) as full_name,
        u.email,
        u.mobile,
        u.user_type as role,
        CASE 
          WHEN u.user_type = 'student' THEN s.school_name
          WHEN u.user_type = 'school' THEN sc.school_name
          ELSE NULL
        END as school_name,
        CASE 
          WHEN u.user_type = 'se' THEN se.employee_id
          ELSE NULL
        END as se_employee_id
      FROM users u
      LEFT JOIN students s ON u.id = s.user_id
      LEFT JOIN schools sc ON u.id = sc.user_id
      LEFT JOIN se_employees se ON u.id = se.user_id
    `);
    
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};


// In userController.js
const getSchoolsBySE = async (req, res) => {
  const { seId } = req.params;
  
  try {
    console.log('Fetching schools for SE ID:', seId);

    // Get schools where employee_id matches the SE's employee_id
    const [schools] = await db.promise().query(
      `SELECT id, school_name, city, state 
       FROM schools 
       WHERE employee_id = ?`,
      [seId]
    );
    
    console.log('Found schools:', schools);
    
    res.status(200).json(schools);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch schools',
      details: error.message 
    });
  }
};

// Add a debug endpoint to check SE details
const checkSEDetails = async (req, res) => {
  const { seId } = req.params;
  
  try {
    const [seDetails] = await db.promise().query(
      `SELECT se.*, u.first_name, u.last_name 
       FROM se_employees se
       JOIN users u ON se.user_id = u.id
       WHERE se.employee_id = ?`,
      [seId]
    );

    // Also get the schools count
    const [schoolsCount] = await db.promise().query(
      `SELECT COUNT(*) as count 
       FROM schools 
       WHERE employee_id = ?`,
      [seId]
    );
    
    res.status(200).json({
      seDetails: seDetails[0],
      schoolsCount: schoolsCount[0].count
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



const fetchSEEmployees = async (req, res) => {
  try {
    const [results] = await db.promise().query(
      `SELECT se.employee_id 
       FROM se_employees se
       JOIN users u ON se.user_id = u.id
       WHERE u.user_type = 'se'
       ORDER BY se.employee_id`
    );
    res.status(200).json(results);
  } catch (error) {
    console.error('Error fetching SE employees:', error);
    res.status(500).json({ error: 'Failed to fetch SE Employee IDs' });
  }
};
// In userController.js

// Add mapping between SE and School
const assignSchoolToSE = async (req, res) => {
  const { seEmployeeId, schoolId } = req.body;
  
  try {
    await db.promise().query(
      `INSERT INTO se_school_mapping (se_employee_id, school_id) 
       VALUES (?, ?)`,
      [seEmployeeId, schoolId]
    );
    
    res.status(200).json({ message: 'School assigned to SE successfully' });
  } catch (error) {
    console.error('Error assigning school to SE:', error);
    res.status(500).json({ error: 'Failed to assign school to SE' });
  }
};

// Remove mapping between SE and School
const removeSchoolFromSE = async (req, res) => {
  const { seEmployeeId, schoolId } = req.params;
  
  try {
    await db.promise().query(
      `DELETE FROM se_school_mapping 
       WHERE se_employee_id = ? AND school_id = ?`,
      [seEmployeeId, schoolId]
    );
    
    res.status(200).json({ message: 'School removed from SE successfully' });
  } catch (error) {
    console.error('Error removing school from SE:', error);
    res.status(500).json({ error: 'Failed to remove school from SE' });
  }
};



// const fetchSEEmployees = async (req, res) => {
//   try {
//     const [results] = await db.promise().query(
//       `SELECT se.employee_id 
//        FROM se_employees se
//        INNER JOIN users u ON se.user_id = u.id
//        WHERE u.user_type = 'se'
//        ORDER BY se.employee_id`
//     );
//     res.status(200).json(results);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Failed to fetch SE Employee IDs' });
//   }
// };


const getStudentCountBySchool = async (req, res) => {
  const { schoolId } = req.params;
  
  try {
    const [result] = await db.promise().query(
      `SELECT COUNT(*) as count 
       FROM students 
       WHERE school_id = ?`,
      [schoolId]
    );
    
    res.status(200).json({ count: result[0].count });
  } catch (error) {
    console.error('Error fetching student count:', error);
    res.status(500).json({ 
      error: 'Failed to fetch student count',
      details: error.message 
    });
  }
};


module.exports = { registerUser, fetchSEEmployees, fetchSchools , getAllUsers, getSchoolsBySE,assignSchoolToSE, removeSchoolFromSE, checkSEDetails,getStudentCountBySchool };