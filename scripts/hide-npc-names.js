import { Utils } from "./utils.js";
import * as MODULE_CONFIG from "./config.js";
import { ActorForm } from "./actor-form.js";

export class HideNPCNames {
    /**
     * Update Actor handler
     * @param {*} actor 
     * @param {*} update 
     * @param {*} options 
     * @param {*} user 
     */
    static onUpdateActor(actor, update, options, user) {
        if (!Utils.hasModuleFlags(update)) return;
        HideNPCNames.updateEntityMessages(actor);
    }

    /**
     * Update Token handler
     * @param {*} token 
     * @param {*} update 
     * @param {*} options 
     * @param {*} user 
     */
    static onUpdateToken(token, update, options, user) {
        if (!Utils.hasModuleFlags(update) && update.disposition == undefined) return;
        HideNPCNames.updateEntityMessages(token);
    }

    /**
     * Updates Chat Messages related to a specific entity (eg. actor or token)
     * @param {*} entity 
     */
    static updateEntityMessages(entity) {
        const isToken = entity instanceof Token || entity instanceof TokenDocument;

        const messages = game.messages.contents.filter(m => m.logged && m.speaker?.[isToken ? "token" : "actor"] === entity.id);
        for (const message of messages) {
            ui.chat.updateMessage(message);

            //Loop over all the apps of this message and trigger their render
            //This is needed to refresh things like popped out chat cards
            for (const app of Object.values(message.apps)) {
                app.render();
            }
        }
    }

    /**
     * Handle render Actor sheet
     * @param {*} app 
     * @param {*} html 
     * @param {*} data 
     */
    static onRenderActorSheet(app, html, data) {
        if (!game.user.isGM || app.object.hasPlayerOwner) return;

        const appEl = html[0].tagName.toLowerCase() == "form" ? html[0].closest("div.app") : html[0];
        const existingButton = appEl.querySelector("a.cub-hide-name");
        if (existingButton) return;

        const buttonEl = document.createElement("a");
        buttonEl?.classList.add("cub-hide-name");
        buttonEl?.setAttribute("style", "flex: 0; margin: 0");
        buttonEl?.setAttribute("title", game.i18n.localize("ActorSheetButton"));
        buttonEl?.addEventListener("click", (event) => { new ActorForm(app.object).render(true); });

        const iconEl = document.createElement("i");
        iconEl?.classList.add("fas", "fa-mask");
        if (iconEl) buttonEl?.append(iconEl);

        const headerEl = appEl?.querySelector("header.window-header");
        headerEl?.prepend(buttonEl);
    }

    /**
     * Hooks on the Combat Tracker render to replace the names
     * @param {Object} app - the Application instance
     * @param {Object} html - jQuery html object
     * @todo refactor required
     */
    static onRenderCombatTracker(app, html, data) {
        // find the NPC combatants
        const combatants = app?.viewed?.combatants?.contents;
        if (!combatants || !combatants?.length) return;

        const npcs = combatants.filter(c => c.actor?.hasPlayerOwner === false).map(npc => {
            const shouldReplace = HideNPCNames.shouldReplaceName(npc.actor);
            const combatantName = HideNPCNames.getCombatantName(npc.actor, npc.name);
            const replacementName = HideNPCNames.getReplacementName(npc.actor, npc.name);
            return {
                id: npc.id,
                shouldReplace: shouldReplace,
                replacementName: replacementName,
                name: combatantName,
                isOwner: npc.actor.isOwner,
                actor: npc.actor
            };
        });

        if (!npcs.length) return;

        //For each replacement, find the matching element and replace
        const combatantListElement = html.find("li");

        for (const el of combatantListElement) {
            const combatantId = el.dataset.combatantId;
            const combatant = game.combat.combatants.get(combatantId);
            const npc = npcs.find(n => n.id === combatant?.id);

            if (!npc) continue;

            if (game.user.isGM || npc.isOwner) {
                const $icon = this.getHideIconHtml(npc.shouldReplace, npc.replacementName);
                $(el).find(".token-name").children().first().append($icon);
                $icon.on("click", (event) => this.onClickCombatTrackerIcon(npc));
                continue;
            }

            $(el).find(".token-name h4").text(npc.name);
            $(el).find(".token-image").attr("title", npc.name);
        }
    }

    /**
     * Handles name replacement for chat messages
     * @param {*} message 
     * @param {*} html 
     * @param {*} data 
     */
    static async onRenderChatMessage(message, html, data) {
        const speaker = message.speaker;
        const name = data?.alias ?? speaker?.alias;
        if (!name || !speaker) return;

        const actor = ChatMessage.getSpeakerActor(speaker);
        if (!actor || actor.hasPlayerOwner) return;

        const shouldReplace = HideNPCNames.shouldReplaceName(actor);
        const replacementName = HideNPCNames.getReplacementName(actor);

        // If we are the GM or the actor's owner, simply apply the icon to the name and return
        if (game.user.isGM || actor.isOwner) {
            const senderName = html.find("header").children().first();
            const $icon = this.getHideIconHtml(shouldReplace, replacementName);
            $icon.on("click", (event) => this.onClickChatMessageIcon(event));
            return senderName.append($icon);
        }

        if (!shouldReplace) return;

        // Escape regex in the match to ensure it is parsed correctly
        let matchString = name.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
        const regex = `(${matchString})(?=\\s|[\\W]|s\\W|'s\\W|$)`;
        const pattern = new RegExp(regex, "gim");

        // Do a replacement on the document
        [html[0],...html[0].querySelectorAll("*:not(script):not(noscript):not(style)")]
        .forEach(({childNodes: [...nodes]}) => nodes
        .filter(({nodeType}) => nodeType === document.TEXT_NODE)
        .forEach((textNode) => textNode.textContent = textNode.textContent.replace(pattern, replacementName)));
    }

    /**
     * Replace names in the image popout
     * @param {*} app 
     * @param {*} html 
     * @param {*} data 
     */
    static onRenderImagePopout(app, html, data) {
        const uuid = app.options?.uuid;
        const actor = uuid?.startsWith("Actor") ? game.actors.get(uuid.replace("Actor.", "")) : null;
        if (!actor) return;

        const shouldReplace = HideNPCNames.shouldReplaceName(actor);
        if (actor.hasPlayerOwner || !shouldReplace) return;

        const windowTitle = html.find(".window-title");
        if (windowTitle.length === 0) return;

        const replacement = HideNPCNames.getReplacementName(actor);
        if (!game.user.isGM || !actor.isOwner) {
            windowTitle.text(replacement);
            const imgDiv = html.find("div.lightbox-image");
            if (!imgDiv.length) return;
            imgDiv.attr("title", replacement);
        } else {
            const icon = `<span> <i class="fas fa-mask" title="${replacement}"></i></span>`;
            windowTitle.append(icon);
        }
    }

    /**
     * Chat Message Icon click handler
     * @param {*} event 
     */
    static async onClickChatMessageIcon(event) {
        const icon = event.target;
        const chatMessageLi = icon?.closest("li.chat-message");
        const messageId = chatMessageLi?.dataset.messageId;
        const message = game.messages.get(messageId);
        const actor = ChatMessage.getSpeakerActor(message?.speaker);
        if (!actor) return;

        const shouldReplace = HideNPCNames.shouldReplaceName(actor);
        await Utils.setModuleFlag(actor, MODULE_CONFIG.FLAGS.nameHiddenOverride, !shouldReplace);
    }

    /**
     * Chat Message Icon click handler
     * @param {*} event 
     */
    static async onClickCombatTrackerIcon(npc) {
        if (!npc.actor) return;

        const shouldReplace = HideNPCNames.shouldReplaceName(npc.actor);
        await Utils.setModuleFlag(npc.actor, MODULE_CONFIG.FLAGS.nameHiddenOverride, !shouldReplace);
    }

    /**
     * Checks an actor to see if its name should be replaced
     * @param {*} actor 
     * @returns {Boolean} shouldReplace
     */
    static shouldReplaceName(actor) {
        const dispositionEnum = actor.isToken ? actor.token.disposition : actor.prototypeToken.disposition;
        const disposition = Utils.getKeyByValue(CONST.TOKEN_DISPOSITIONS, dispositionEnum);
        const hideSetting = Utils.getSetting(MODULE_CONFIG.SETTING_KEYS[`hide${disposition.titleCase()}`]);
        const nameHiddenOverride = Utils.getModuleFlag(actor, MODULE_CONFIG.FLAGS.nameHiddenOverride);
        const shouldReplace = nameHiddenOverride ?? hideSetting;

        return !!shouldReplace;
    }

    /**
     * For a given actor, find out if there is a replacement name and return it
     * @param {*} actor 
     * @returns {String} replacementName
     */
    static getCombatantName(actor, defaultName) {
        if (game.user.isGM || actor.isOwner) return defaultName;
        
        const shouldReplace = HideNPCNames.shouldReplaceName(actor);
        if (!shouldReplace) return defaultName;
        
        return HideNPCNames.getReplacementName(actor);
    }

    /**
     * For a given actor, find out if there is a replacement name and return it
     * @param {*} actor 
     * @returns {String} replacementName
     */
    static getReplacementName(actor) {
        const dispositionEnum = actor.isToken ? actor.token.disposition : actor.prototypeToken.disposition;
        const disposition = Utils.getKeyByValue(CONST.TOKEN_DISPOSITIONS, dispositionEnum);
        const replacementSetting = Utils.getSetting(MODULE_CONFIG.SETTING_KEYS[`${disposition.toLowerCase()}NameReplacement`]);
        const replacementNameOverride = Utils.getModuleFlag(actor, MODULE_CONFIG.FLAGS.replacementNameOverride);
        const replacementName = replacementNameOverride ?? replacementSetting;

        return replacementName;
    }

    /**
     * Generates the html for the show/hide icon
     * @param {*} shouldReplace 
     * @param {*} replacementName 
     * @returns {String} icon html
     */
    static getHideIconHtml(shouldReplace, replacementName) {
        const title = `${shouldReplace ? `${game.i18n.localize(`MessageIcon.Title.NameHiddenPrefix`)} ${replacementName} ${game.i18n.localize(`MessageIcon.Title.NameHiddenSuffix`)}` : game.i18n.localize(`MessageIcon.Title.NameNotHidden`)}`;
        const $icon = $(
            `<a class="hide-name"><span class="fa-stack fa-1x" title="${title}"><i class="fas fa-mask fa-stack-1x"></i>
            ${!shouldReplace ? `<i class="fas fa-slash fa-stack-1x"></i>` : ""}</span></a>`
        );
        return $icon;
    }
}