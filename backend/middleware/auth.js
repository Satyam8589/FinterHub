import jwt from "jsonwebtoken";

export const auth = (req, res, next) => {
    try {
        const authHeader = req.header("Authorization");
        if (!authHeader) {
            return res.status(401).json({ message: "Unauthorized - No token provided" });
        }
        const token = authHeader.startsWith("Bearer ") 
            ? authHeader.slice(7) 
            : authHeader;
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return res.status(401).json({ message: "Unauthorized - Invalid token" });
        }
        req.user = { _id: decoded.id };
        next();
    } catch (error) {
        return res.status(401).json({ message: "Unauthorized - " + error.message });
    }
};