import * as MODULE_CONFIG from "./config.js";

/**
 * Provides helper methods for use elsewhere in the module
 */
export class Utils {

    /**
     * Get a single setting using the provided key
     * @param {*} key
     * @returns {Object} setting
     */
    static getSetting(key) {
        return game.settings.get(MODULE_CONFIG.NAME, key);
    }

    /**
     * Sets a single game setting
     * @param {*} key
     * @param {*} value
     * @param {*} awaitResult
     * @returns {Promise | ClientSetting}
     */
    static async setSetting(key, value, awaitResult=false) {
        if (!awaitResult) {
            return game.settings.set(MODULE_CONFIG.NAME, key, value);
        }

        await game.settings.set(MODULE_CONFIG.NAME, key, value).then(result => {
            return result;
        }).catch(rejected => {
            throw rejected;
        });
    }

    /**
     * Register a single setting using the provided key and setting data
     * @param {*} key
     * @param {*} metadata
     * @returns {ClientSettings.register}
     */
    static registerSetting(key, metadata) {
        return game.settings.register(MODULE_CONFIG.NAME, key, metadata);
    }

    /**
     * Register a menu setting using the provided key and setting data
     * @param {*} key
     * @param {*} metadata
     * @returns {ClientSettings.registerMenu}
     */
    static registerMenu(key, metadata) {
        return game.settings.registerMenu(MODULE_CONFIG.NAME, key, metadata);
    }

    /**
     * Loads templates for partials
     */
    static async loadTemplates() {
        const templates = [
        ];
        await foundry.applications.handlebars.loadTemplates(templates)
    }

    static showNotification(type, message, options) {
        const msg = `${MODULE_CONFIG.SHORT_TITLE} | ${message}`;
        return ui.notifications[type](msg, options);
    }

    static consoleMessage(type, {objects=[], message="", subStr=[]}) {
        const msg = `${MODULE_CONFIG.TITLE} | ${message}`;
        const params = [];
        if (objects && objects.length) params.push(objects);
        if (msg) params.push(msg);
        if (subStr && subStr.length) params.push(subStr);
        return console[type](...params);
    }

    static hasModuleFlags(obj) {
        if (!obj.flags) {
            return false;
        }

        return obj.flags[MODULE_CONFIG.NAME] ? true : false;
    }

    static getModuleFlag(obj, flag) {
        if (!Utils.hasModuleFlags(obj)) {
            return;
        }

        return obj.flags[MODULE_CONFIG.NAME][flag];
    }

    static async setModuleFlag(obj, flag, data) {
        return await obj.setFlag(MODULE_CONFIG.NAME, flag, data);
    }

    /**
     * Retrieves a key using the given value
     * @param {Object} object -- the object that contains the key/value
     * @param {*} value
     */
    static getKeyByValue(object, value) {
        return Object.keys(object).find(key => object[key] === value);
    }

    /**
     * Takes an array of terms (eg. name parts) and returns groups of neighbouring terms
     * @param {*} arr
     */
    static getTerms(arr) {
        const terms = [];
        const rejectTerms = ["of", "its", "the", "a", "it's", "if", "in", "for", "on", "by", "and"];
        for ( let i of arr.keys() ) {
            let len = arr.length - i;
            for ( let p=0; p<=i; p++ ) {
                let part = arr.slice(p, p+len);
                if (part.length === 1 && rejectTerms.includes(part[0])) {
                    continue;
                }
                terms.push(part.join(" "));
            }
        }
        return terms;
    }

    /**
     * Escapes regex special chars
     * @param {String} string
     * @return {String} escapedString
     */
    static escapeRegExp(string) {
        return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Gets the base actor if this is a token actor
     * @param {Actor} actor
     * @return {Actor} base actor
     */
    static getBaseActor(actor) {
        return actor.isToken ? actor.token.baseActor : actor;
    }

    /**
     * Gets an actor from a UUID
     * @param {String} uuid
     * @return {Actor} actor
     */
    static async getActorFromUuid(uuid) {
        const actor = await fromUuid(uuid);
        return actor instanceof Actor ? actor : actor instanceof foundry.canvas.placeables.Token || actor instanceof TokenDocument ? actor.actor : null;
    }
}