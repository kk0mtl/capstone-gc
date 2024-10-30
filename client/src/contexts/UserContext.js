import React, { createContext, useContext, useState, useEffect } from "react";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState([]);

    useEffect(() => {
        const user = sessionStorage.getItem("user");
        if (user && !currentUser.includes(user)) {
            setCurrentUser((prevUsers) => [...prevUsers, user]);
        }
    }, []);

    return (
        <UserContext.Provider value={{ currentUser, setCurrentUser }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    return useContext(UserContext);
};
