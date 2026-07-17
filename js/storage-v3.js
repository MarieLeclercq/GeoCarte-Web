// Storage is handled in app.js via localStorage
// This file is for future cloud sync features

const Storage = {
    save(key, data) {
        try {
            localStorage.setItem('geocarte_' + key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Storage save error:', e);
            return false;
        }
    },

    load(key) {
        try {
            const data = localStorage.getItem('geocarte_' + key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Storage load error:', e);
            return null;
        }
    },

    remove(key) {
        localStorage.removeItem('geocarte_' + key);
    },

    clear() {
        Object.keys(localStorage)
            .filter(k => k.startsWith('geocarte_'))
            .forEach(k => localStorage.removeItem(k));
    },

    getUsedSpace() {
        let total = 0;
        Object.keys(localStorage)
            .filter(k => k.startsWith('geocarte_'))
            .forEach(k => total += localStorage.getItem(k).length * 2);
        return total;
    }
};
