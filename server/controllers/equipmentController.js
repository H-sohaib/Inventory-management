const { pool } = require("../config/dbConfig");

// @desc    Get all equipment
// @route   GET /api/equipments
// @access  Public
const getAllEquipment = async (req, res) => {
  try {
    const { category, status, available } = req.query;

    let query = `
      SELECT e.id, e.nom, e.description, e.categorie, e.quantite, e.image, e.datasheet_url,
             s.etat,
             CASE WHEN st.qr_code IS NOT NULL THEN st.qr_code ELSE NULL END as qr_code
      FROM Equipement e
      LEFT JOIN Solo s ON e.id = s.id
      LEFT JOIN Stockable st ON e.id = st.id
    `;

    const conditions = [];
    const params = [];

    if (category) {
      conditions.push("e.categorie = ?");
      params.push(category);
    }

    if (status) {
      conditions.push("s.etat = ?");
      params.push(status);
    }

    if (available === "true") {
      conditions.push(
        '(e.categorie = "stockable" AND e.quantite > 0) OR (e.categorie = "solo" AND s.etat = "disponible")'
      );
    }

    if (conditions.length) {
      query += " WHERE " + conditions.join(" AND ");
    }

    const [equipment] = await pool.execute(query, params);
    res.json(equipment);
  } catch (error) {
    console.error("Error fetching equipment:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get equipment by ID
// @route   GET /api/equipments/:id
// @access  Public
const getEquipmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const [equipment] = await pool.execute(
      `SELECT e.id, e.nom, e.description, e.categorie, e.quantite, e.image, e.datasheet_url,
              CASE WHEN s.id IS NOT NULL THEN s.etat ELSE NULL END as etat,
              CASE WHEN st.id IS NOT NULL THEN st.qr_code ELSE NULL END as qr_code
       FROM Equipement e
       LEFT JOIN Solo s ON e.id = s.id
       LEFT JOIN Stockable st ON e.id = st.id
       WHERE e.id = ?`,
      [id]
    );

    if (equipment.length === 0) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    res.json(equipment[0]);
  } catch (error) {
    console.error("Error fetching equipment details:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const path = require("path");
const fs = require("fs");
// Ensure default image directory exists
const defaultimage = "uploads/equipment/default-equipment.png";
const defaultImageDir = path.join(__dirname, "..", "uploads/equipment");
if (!fs.existsSync(defaultImageDir)) {
  fs.mkdirSync(defaultImageDir, { recursive: true });
}

// @desc    Create new equipment
// @route   POST /api/equipments
// @access  Private
const createEquipment = async (req, res) => {
  console.log("Received request:", req.body, req.file);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Extract data from request body with fallbacks
    const nom = req.body.nom || "Unnamed Equipment";
    const description = req.body.description || "";
    const categorie = req.body.categorie || "stockable";
    const etat = req.body.etat || "disponible";
    const quantite = parseInt(req.body.quantite || "1");
    const datasheetUrl = req.body.datasheet_url || null;

    // Handle image path
    let image = "public/images/default-equipment.png"; // Default image
    if (req.file) {
      image = `uploads/equipment/${req.file.filename}`;
    }

    // First create in main Equipement table - add datasheet_url to the query
    const [result] = await connection.execute(
      "INSERT INTO Equipement (nom, description, categorie, quantite, image, datasheet_url) VALUES (?, ?, ?, ?, ?, ?)",
      [nom, description, categorie, quantite, image, datasheetUrl]
    );

    const newEquipmentId = result.insertId;

    // Then add to specific type table based on category
    if (categorie === "solo") {
      await connection.execute("INSERT INTO Solo (id, etat) VALUES (?, ?)", [
        newEquipmentId,
        etat,
      ]);
    } else if (categorie === "stockable") {
      await connection.execute(
        "INSERT INTO Stockable (id, quantite) VALUES (?, ?)",
        [newEquipmentId, quantite]
      );
    }

    await connection.commit();

    res.status(201).json({
      id: newEquipmentId,
      nom,
      description,
      categorie,
      etat: categorie === "solo" ? etat : null,
      quantite,
      image: image,
      datasheet_url: datasheetUrl,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating equipment:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    connection.release();
  }
};

// @desc    Update equipment
// @route   PUT /api/equipments/:id
// @access  Private
const updateEquipment = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const {
      nom,
      description,
      categorie,
      quantite,
      etat,
      qr_code,
      previousStatus,
      technicianId,
      technicianName,
      datasheet_url,
    } = req.body;

    // First, check if equipment exists and get current data
    const [existing] = await connection.execute(
      "SELECT image, datasheet_url FROM Equipement WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Equipment not found" });
    }

    const currentImagePath = existing[0].image;
    const currentDatasheetUrl = existing[0].datasheet_url;

    // Handle image update
    let newImagePath = null;
    if (req.file) {
      newImagePath = `uploads/equipment/${req.file.filename}`;

      // Update image path in database
      await connection.execute("UPDATE Equipement SET image = ? WHERE id = ?", [
        newImagePath,
        id,
      ]);

      // Delete the old image if it exists and isn't the default image
      if (
        currentImagePath &&
        !currentImagePath.includes("public/images/default-equipment.png")
      ) {
        const fullOldImagePath = path.join(__dirname, "..", currentImagePath);

        // Check if file exists before attempting deletion
        if (fs.existsSync(fullOldImagePath)) {
          fs.unlink(fullOldImagePath, (err) => {
            if (err) {
              console.error("Error deleting old equipment image file:", err);
            } else {
              console.log(
                `Successfully deleted old image file: ${fullOldImagePath}`
              );
            }
          });
        }
      }
    }

    // Update main Equipement table - add datasheet_url to the query
    await connection.execute(
      "UPDATE Equipement SET nom = ?, description = ?, quantite = ?, datasheet_url = ? WHERE id = ?",
      [
        nom,
        description,
        quantite,
        datasheet_url === undefined || datasheet_url === ""
          ? currentDatasheetUrl
          : datasheet_url,
        id,
      ]
    );

    // Update specific type table based on category
    if (categorie === "solo") {
      const [soloCheck] = await connection.execute(
        "SELECT * FROM Solo WHERE id = ?",
        [id]
      );

      if (soloCheck.length > 0) {
        await connection.execute(
          "UPDATE Solo SET etat = ? WHERE id = ?",
          [etat || "disponible", id] // Use ENUM value directly
        );
      } else {
        // Handle type change if needed
        await connection.execute("DELETE FROM Stockable WHERE id = ?", [id]);
        await connection.execute(
          "INSERT INTO Solo (id, etat) VALUES (?, ?)",
          [id, etat || "disponible"] // Use ENUM value directly
        );
        await connection.execute(
          'UPDATE Equipement SET categorie = "solo" WHERE id = ?',
          [id]
        );
      }
    } else if (categorie === "stockable") {
      const [stockableCheck] = await connection.execute(
        "SELECT * FROM Stockable WHERE id = ?",
        [id]
      );

      if (stockableCheck.length > 0) {
        await connection.execute(
          "UPDATE Stockable SET quantite = ?, qr_code = ? WHERE id = ?",
          [quantite, qr_code || null, id]
        );
      } else {
        // Handle type change if needed
        await connection.execute("DELETE FROM Solo WHERE id = ?", [id]);
        await connection.execute(
          "INSERT INTO Stockable (id, quantite, qr_code) VALUES (?, ?, ?)",
          [id, quantite, qr_code || null]
        );
        await connection.execute(
          'UPDATE Equipement SET categorie = "stockable" WHERE id = ?',
          [id]
        );
      }
    }

    // Get equipment details
    const [equipResult] = await connection.execute(
      "SELECT nom FROM Equipement WHERE id = ?",
      [id]
    );
    const equipmentName = equipResult[0]?.nom || `Equipment #${id}`;

    // Create notifications based on status transitions
    if (previousStatus === "disponible" && etat === "indisponible") {
      // Available to unavailable
      await connection.execute(
        'INSERT INTO Notification (id_utilisateur, message, date_envoi, statut) VALUES (?, ?, NOW(), "envoye")',
        [technicianId, `${equipmentName} #${id} is marked as unavailable`]
      );

      // Notify responsables
      const [responsables] = await connection.execute(
        'SELECT id FROM Utilisateur WHERE role = "responsable"'
      );

      for (const resp of responsables) {
        await connection.execute(
          'INSERT INTO Notification (id_utilisateur, message, date_envoi, statut) VALUES (?, ?, NOW(), "envoye")',
          [
            resp.id,
            `${technicianName} has marked ${equipmentName} #${id} as unavailable`,
          ]
        );
      }
    } else if (previousStatus === "indisponible" && etat === "en_reparation") {
      // Unavailable to in repair
      await connection.execute(
        'INSERT INTO Notification (id_utilisateur, message, date_envoi, statut) VALUES (?, ?, NOW(), "envoye")',
        [technicianId, `${equipmentName} #${id} is now in repair`]
      );

      // Notify responsables
      const [responsables] = await connection.execute(
        'SELECT id FROM Utilisateur WHERE role = "responsable"'
      );

      for (const resp of responsables) {
        await connection.execute(
          'INSERT INTO Notification (id_utilisateur, message, date_envoi, statut) VALUES (?, ?, NOW(), "envoye")',
          [resp.id, `${technicianName} is repairing ${equipmentName} #${id}`]
        );
      }
    } else if (previousStatus === "en_reparation" && etat === "disponible") {
      // In repair to available
      await connection.execute(
        'INSERT INTO Notification (id_utilisateur, message, date_envoi, statut) VALUES (?, ?, NOW(), "envoye")',
        [
          technicianId,
          `${equipmentName} #${id} has been repaired and is now available`,
        ]
      );

      // Notify responsables
      const [responsables] = await connection.execute(
        'SELECT id FROM Utilisateur WHERE role = "responsable"'
      );

      for (const resp of responsables) {
        await connection.execute(
          'INSERT INTO Notification (id_utilisateur, message, date_envoi, statut) VALUES (?, ?, NOW(), "envoye")',
          [resp.id, `${technicianName} has repaired ${equipmentName} #${id}`]
        );
      }
    }

    await connection.commit();

    res.json({
      id,
      message: "Equipment updated successfully",
      image_path: newImagePath,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating equipment:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    connection.release();
  }
};

// @desc    Delete equipment
// @route   DELETE /api/equipments/:id
// @access  Private
// @desc    Delete equipment
// @route   DELETE /api/equipments/:id
// @access  Private
const deleteEquipment = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // First get the image path and other info before deleting
    const [equipmentData] = await connection.execute(
      "SELECT e.id, e.categorie, e.image FROM Equipement e WHERE e.id = ?",
      [id]
    );

    if (equipmentData.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Equipment not found" });
    }

    const equipmentType = equipmentData[0].categorie;
    const imagePath = equipmentData[0].image;

    console.log(
      `Deleting equipment #${id} of type ${equipmentType} with image: ${imagePath}`
    );

    // Check for reservations
    const [reservations] = await connection.execute(
      "SELECT * FROM Reservation_Equipement WHERE id_equipement = ?",
      [id]
    );

    if (reservations.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        message: "Cannot delete equipment that has reservations",
      });
    }

    try {
      // Delete from specific type tables first (due to foreign key constraints)
      if (equipmentType === "solo") {
        await connection.execute("DELETE FROM Solo WHERE id = ?", [id]);
        console.log(`Deleted from Solo table: equipment #${id}`);
      } else if (equipmentType === "stockable") {
        await connection.execute("DELETE FROM Stockable WHERE id = ?", [id]);
        console.log(`Deleted from Stockable table: equipment #${id}`);
      }

      // Then delete from main table
      await connection.execute("DELETE FROM Equipement WHERE id = ?", [id]);
      console.log(`Deleted from Equipement table: equipment #${id}`);

      await connection.commit();

      // Now handle image deletion if needed
      if (imagePath) {
        // Skip deleting default images
        if (
          !imagePath.includes("public/images/default-equipment.png") &&
          !imagePath.includes("default-equipment")
        ) {
          const fullImagePath = path.join(__dirname, "..", imagePath);
          console.log(`Attempting to delete image at: ${fullImagePath}`);

          if (fs.existsSync(fullImagePath)) {
            fs.unlinkSync(fullImagePath);
            console.log(`Successfully deleted image file: ${fullImagePath}`);
          } else {
            console.log(`Image file not found at: ${fullImagePath}`);
          }
        } else {
          console.log("Skipping deletion of default image");
        }
      }

      res.json({
        message: "Equipment deleted successfully",
        id,
        type: equipmentType,
      });
    } catch (dbError) {
      await connection.rollback();
      console.error("Database error during deletion:", dbError);
      res
        .status(500)
        .json({ message: "Database error", error: dbError.message });
    }
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("Error during rollback:", rollbackError);
    }
    console.error("Error deleting equipment:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    connection.release();
  }
};

// @desc    Get stockable equipment
// @route   GET /api/equipments/stockable
// @access  Public
const getStockableEquipment = async (req, res) => {
  try {
    const [equipment] = await pool.execute(`
      SELECT e.id, e.nom, e.description, e.categorie, e.image, e.datasheet_url,
             st.quantite, st.qr_code
      FROM Equipement e
      JOIN Stockable st ON e.id = st.id
      WHERE e.categorie = 'stockable'
    `);

    res.json(equipment);
  } catch (error) {
    console.error("Error fetching stockable equipment:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get solo equipment
// @route   GET /api/equipments/solo
// @access  Public
const getSoloEquipment = async (req, res) => {
  try {
    const [equipment] = await pool.execute(`
      SELECT e.id, e.nom, e.description, e.categorie, e.datasheet_url, e.image, s.etat 
      FROM Equipement e
      JOIN Solo s ON e.id = s.id
      WHERE e.categorie = 'solo'
    `);

    res.json(equipment);
  } catch (error) {
    console.error("Error fetching solo equipment:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update equipment status
// @route   PATCH /api/equipments/:id/status
// @access  Private
const updateEquipmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { etat } = req.body;

    if (!etat) {
      return res.status(400).json({ message: "Status is required" });
    }

    // Validate the status is one of the allowed ENUM values
    if (
      !["disponible", "en_cours", "indisponible", "en_reparation"].includes(
        etat
      )
    ) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const [result] = await pool.execute(
      "UPDATE Solo SET etat = ? WHERE id = ?",
      [etat, id]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Equipment not found or not of type Solo" });
    }

    res.json({ message: "Equipment status updated successfully" });
  } catch (error) {
    console.error("Error updating equipment status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update equipment state with notifications
// @route   PATCH /api/equipments/:id
// @access  Private
const updateEquipmentState = async (req, res) => {
  const { id } = req.params;
  const { etat: newState, oldState, technicianId, technicianName } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Update equipment state in database
    await connection.execute("UPDATE Solo SET etat = ? WHERE id = ?", [
      newState,
      id,
    ]);

    // Get equipment details
    const [equipment] = await connection.execute(
      "SELECT nom FROM Equipement WHERE id = ?",
      [id]
    );

    if (equipment.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Equipment not found" });
    }

    const equipmentName = equipment[0].nom;

    // Get technician details if not provided
    let techFullName = technicianName;
    if (!techFullName && technicianId) {
      const [techDetails] = await connection.execute(
        "SELECT nom, prenom FROM Utilisateur WHERE id = ?",
        [technicianId]
      );

      if (techDetails.length > 0) {
        techFullName = `${techDetails[0].prenom} ${techDetails[0].nom}`;
      } else {
        techFullName = "A technician";
      }
    }

    // Handle state transitions for notifications
    if (oldState === "disponible" && newState === "indisponible") {
      // Notification to technician
      await connection.execute(
        'INSERT INTO Notification (id_utilisateur, message, date_envoi, statut) VALUES (?, ?, NOW(), "envoye")',
        [technicianId, `${equipmentName} #${id} is now unavailable`]
      );

      // Notification to responsables
      const [responsables] = await connection.execute(
        'SELECT id FROM Utilisateur WHERE role = "responsable"'
      );

      for (const resp of responsables) {
        await connection.execute(
          'INSERT INTO Notification (id_utilisateur, message, date_envoi, statut) VALUES (?, ?, NOW(), "envoye")',
          [
            resp.id,
            `${techFullName} has marked ${equipmentName} #${id} as unavailable`,
          ]
        );
      }
    } else if (oldState === "indisponible" && newState === "en_reparation") {
      // Notification to technician
      await connection.execute(
        'INSERT INTO Notification (id_utilisateur, message, date_envoi, statut) VALUES (?, ?, NOW(), "envoye")',
        [technicianId, `${equipmentName} #${id} is now in repair`]
      );

      // Notification to responsables
      const [responsables] = await connection.execute(
        'SELECT id FROM Utilisateur WHERE role = "responsable"'
      );

      for (const resp of responsables) {
        await connection.execute(
          'INSERT INTO Notification (id_utilisateur, message, date_envoi, statut) VALUES (?, ?, NOW(), "envoye")',
          [resp.id, `${techFullName} is repairing ${equipmentName} #${id}`]
        );
      }
    } else if (oldState === "en_reparation" && newState === "disponible") {
      // Notification to technician
      await connection.execute(
        'INSERT INTO Notification (id_utilisateur, message, date_envoi, statut) VALUES (?, ?, NOW(), "envoye")',
        [technicianId, `${equipmentName} #${id} has been repaired`]
      );

      // Notification to responsables
      const [responsables] = await connection.execute(
        'SELECT id FROM Utilisateur WHERE role = "responsable"'
      );

      for (const resp of responsables) {
        await connection.execute(
          'INSERT INTO Notification (id_utilisateur, message, date_envoi, statut) VALUES (?, ?, NOW(), "envoye")',
          [resp.id, `${techFullName} has repaired ${equipmentName} #${id}`]
        );
      }
    }

    await connection.commit();

    res.json({
      message: `Equipment status changed from ${oldState} to ${newState}`,
      equipment: {
        id,
        name: equipmentName,
        state: newState,
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating equipment state:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    connection.release();
  }
};

module.exports = {
  getAllEquipment,
  getEquipmentById,
  createEquipment,
  updateEquipment,
  updateEquipmentStatus,
  deleteEquipment,
  getStockableEquipment,
  getSoloEquipment,
  updateEquipmentState,
};
