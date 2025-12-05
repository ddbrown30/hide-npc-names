import { Utils } from "./utils.js";
import { ActorForm } from "./actor-form.js";
import { FLAGS, SETTING_KEYS } from "./config.js";

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
        for (let token of actor.getActiveTokens()) {
            token.refresh();
        }
    }

    /**
     * Refresh Token handler
     * @param {*} token
     */
    static onRefreshToken(token) {
        if (game.user.isGM && HideNPCNames.shouldReplaceName(token.actor)) {
            let hiddenSuffix = Utils.getSetting(SETTING_KEYS.tokenHiddenSuffix);
            token.nameplate.text = token.name + " " + hiddenSuffix;
            token.nameplate.style = token._getTextStyle();
        }
    }

    /**
     * Update Token handler
     * @param {*} tokenDocument
     * @param {*} update
     * @param {*} options
     * @param {*} user
     */
    static onUpdateToken(tokenDocument, update, options, user) {
        if (Utils.hasModuleFlags(update) ||
            update.disposition != undefined ||
            update.name != undefined) {
            HideNPCNames.updateEntityMessages(tokenDocument);
            if (tokenDocument.object) {
                tokenDocument.object.refresh();
            }
        }
    }

    /**
     * Updates Chat Messages related to a specific entity (eg. actor or token)
     * @param {*} entity
     */
    static updateEntityMessages(entity) {
        const isToken = entity instanceof foundry.canvas.placeables.Token || entity instanceof TokenDocument;

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
        const existingButton = appEl.querySelector("a.hide-name");
        if (existingButton) return;

        const buttonEl = document.createElement("a");
        buttonEl?.classList.add("hide-name");
        buttonEl?.setAttribute("style", "flex: 0; margin: 0");
        buttonEl?.setAttribute("title", game.i18n.localize("HNN.ActorSheetButton"));
        buttonEl?.addEventListener("click", (event) => { new ActorForm(app.object).render(true); });

        const iconEl = document.createElement("i");
        iconEl?.classList.add("fas", "fa-mask", "hide-icon");
        if (iconEl) buttonEl?.append(iconEl);

        const headerEl = appEl?.querySelector("header.window-header");
        headerEl?.prepend(buttonEl);
    }

    /**
     * Update the actor sheet header
     */
    static onGetHeaderControlsBaseActorSheet(app, controls) {
        if (!game.user.isGM || app.actor.hasPlayerOwner) return;

        app.options.actions["showHideNamesForm"] = function (event, button) { new ActorForm(app.actor).render(true); };
        controls.push({
            action: "showHideNamesForm",
            label: game.i18n.localize("HNN.ActorForm.Title"),
            icon: "fas fa-mask",
            ownership:"OWNER"
        });
    }

    /**
     * Hooks on the Combat Tracker render to replace the names
     * @param {Object} app - the Application instance
     * @param {Object} html - html object
     */
    static onRenderCombatTracker(app, html, data) {
        // find the NPC combatants
        const combatants = app?.viewed?.combatants?.contents;
        if (!combatants || !combatants?.length) return;

        const npcs = combatants.filter(c => c.actor?.hasPlayerOwner === false).map(npc => {
            const replacementInfo = HideNPCNames.getReplacementInfo(npc.actor, npc.name);
            return {
                ...replacementInfo,
                id: npc.id,
                isOwner: npc.actor.isOwner,
                actor: npc.actor
            };
        });

        if (!npcs.length) return;

        //For each replacement, find the matching element and replace
        const combatantListElement = html.querySelectorAll("li");

        for (const el of combatantListElement) {
            const combatantId = el.dataset.combatantId;
            const combatant = game.combat.combatants.get(combatantId);
            const npc = npcs.find(n => n.id === combatant?.id);

            if (!npc) continue;

            if (game.user.isGM || npc.isOwner) {
                const icon = this.getHideIconHtml(npc);
                icon.addEventListener("click", (event) => {
                    event.stopPropagation();
                    this.toggleActorHidden(npc.actor);
                });
                //senderName.insertBefore(icon, senderName.firstChild);
                el.querySelector(".token-name").firstElementChild.appendChild(icon);
            }
        }
    }

    /**
     * Hooks on the Actor Directory render to add the reveal button
     * @param {Object} app - the Application instance
     * @param {Object} html - html object
     */
    static async onRenderActorDirectory(app, html) {
        if (!Utils.getSetting(SETTING_KEYS.showOnActorDirectory)) return;

        //For each replacement, find the matching element and replace
        const actorListElement = html.querySelectorAll("li");
        for (const el of actorListElement) {
            const entryId = el.dataset.entryId;
            if (entryId) {
                const actor = game.actors.get(entryId);
                if (actor && !actor.hasPlayerOwner && (game.user.isGM || actor.isOwner)) {
                    const replacementInfo = HideNPCNames.getReplacementInfo(actor, actor.name);
                    const icon = this.getHideIconHtml(replacementInfo);
                    icon.addEventListener("click", async (event) => {
                        event.stopPropagation();
                        await this.toggleActorHidden(actor);
                    });
                    el.appendChild(icon);
                }
            }
        }
    }

    /**
     * Hooks on the render of the token hud to add a new button
     * @param {Object} app - the Application instance
     * @param {Object} html - html object
     */
    static async onRenderTokenHUD(app, html, data, options) {
        if (!Utils.getSetting(SETTING_KEYS.showOnTokenHUD)) return;

        let actor = game.actors.get(app.object.document.actorId);
        if (!actor || actor.hasPlayerOwner) return;

        if (!game.user.isGM && !actor.isOwner) {
            return;
        }

        const replacementInfo = HideNPCNames.getReplacementInfo(actor, actor.name);

        const hideButton = document.createElement("button");
        hideButton.classList.add("control-icon");
        hideButton.type = "button";
        hideButton.dataset.action ="toggleActorHidden";
        hideButton.dataset.tooltip = `${replacementInfo.shouldReplace
            ? `${game.i18n.localize(`HNN.MessageIcon.Title.NameHiddenPrefix`)} ${replacementInfo.replacementName} ${game.i18n.localize(`HNN.MessageIcon.Title.NameHiddenSuffix`)}`
            : game.i18n.localize(`HNN.MessageIcon.Title.NameNotHidden`)}`;

        const icon = document.createElement("span");
        icon.innerHTML = `<span class="fa-stack fa-1x hide-icon"><i class="fas fa-mask fa-stack-1x"></i>
        ${!replacementInfo.shouldReplace ? `<i class="fas fa-slash fa-stack-1x"></i>` : ""}</span>`;

        hideButton.appendChild(icon);
        const configButton = html.querySelector("[data-action='config']")
        configButton.parentNode.insertBefore(hideButton, configButton);

        app.options.actions["toggleActorHidden"] = () => this.toggleActorHidden(actor);
    }

    /**
     * Removes the hidden suffix from the alias
     * @param {*} message
     * @param {*} options
     * @param {*} userId
     */
    static async onCreateChatMessage(message, options, userId) {
        if (!game.user.isGM) return;
        if (!message.speaker.token && !message.speaker.actor) return;

        //An unfortunate hack required because of the way we override the name property
        //When we create a new message, we need to remove the hidden suffix from the alias otherwise that is what the unhidden name will be on the chat card

        //Start by getting the token if we have one
        let token = message.speaker.token && message.speaker.scene ? game.scenes.get(message.speaker.scene).tokens.get(message.speaker.token) : null;

        //Get the default alias for the speaker
        let baseAlias = token?.__name ?? game.actors.get(message.speaker.actor).name;

        //Find the string in the current alias of the baseAlias + the hiddenSuffix and remove the hidden suffix
        let hiddenSuffix = Utils.getSetting(SETTING_KEYS.tokenHiddenSuffix);
        let newAlias = message.speaker.alias.replace(`${baseAlias} ${hiddenSuffix}`, baseAlias);
        if (newAlias != message.speaker.alias) {
            await message.update({ speaker: { alias: newAlias } });
        }
    }

    /**
     * Handles name replacement for chat messages
     * @param {*} message
     * @param {*} html
     * @param {*} data
     */
    static async onRenderChatMessageHTML(message, html, data) {
        const speaker = message.speaker;
        const name = data?.alias ?? speaker?.alias;
        if (!name || !speaker) return;

        const actor = ChatMessage.getSpeakerActor(speaker);
        if (!actor || actor.hasPlayerOwner) return;

        const replacementInfo = HideNPCNames.getReplacementInfo(actor, name);

        // If we are the GM or the actor's owner, simply apply the icon to the name and return
        if (game.user.isGM || actor.isOwner) {
            const senderName = html.querySelector("header").firstElementChild;
            const icon = this.getHideIconHtml(replacementInfo);
            icon.addEventListener("click", (event) => this.onClickChatMessageIcon(event));
            senderName.insertBefore(icon, senderName.firstChild);
            return;
        }

        const nameToUse = replacementInfo.shouldReplace ? replacementInfo.replacementName : replacementInfo.displayName;

        const hideParts = Utils.getSetting(SETTING_KEYS.hideParts);
        let matchString = null;

        // If there's a space in the name and name parts should be hidden, perform additional manipulation
        if (name.includes(" ") && hideParts) {
            const parts = name.trim().split(/\s/).filter(w => w.length);
            const terms = Utils.getTerms(parts);

            if (terms.length) {
                // If the first term is not exactly the name provided, use the name instead
                // this accounts for names with multiple consecutive spaces
                if (terms[0] !== name) { terms[0] = name; }
                matchString = terms.map(t => { return Utils.escapeRegExp(t.trim()); }).filter(t => t.length).join("|");
            }
        }

        matchString = matchString ?? Utils.escapeRegExp(name);

        // Escape regex in the match to ensure it is parsed correctly
        const regex = `(${matchString})(?=\\s|[\\W]|s\\W|'s\\W|$)`;
        const pattern = new RegExp(regex, "gim");

        // Do a replacement on the document
        [html,...html.querySelectorAll("*:not(script):not(noscript):not(style)")]
        .forEach(({childNodes: [...nodes]}) => nodes
        .filter(({nodeType}) => nodeType === document.TEXT_NODE)
        .forEach((textNode) => textNode.textContent = textNode.textContent.replace(pattern, nameToUse)));
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

        const windowTitle = html.querySelector(".window-title");
        if (windowTitle.length === 0) return;

        const replacement = HideNPCNames.getReplacementName(actor);
        if (!game.user.isGM || !actor.isOwner) {
            windowTitle.textContent = replacement;
        } else {
            const icon = `<span> <i class="fas fa-mask" title="${replacement}"></i></span>`;
            windowTitle.insertAdjacentHTML("beforeend", icon);
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
        this.toggleActorHidden(actor);
    }

    /**
     * @param {Actor} actor
     */
    static async toggleActorHidden(actor) {
        if (!actor) return;

        let replacementInfo = HideNPCNames.getReplacementInfo(actor);

        let baseActor = Utils.getBaseActor(actor);
        await Utils.setModuleFlag(baseActor, FLAGS.nameHiddenOverride, !replacementInfo.shouldReplace);

        if (Utils.getSetting(SETTING_KEYS.showOnActorDirectory)) {
            replacementInfo = HideNPCNames.getReplacementInfo(baseActor);
            let selector = `[data-entry-id="${baseActor.id.toString()}"]`;
            this.swapIcon(replacementInfo, ui.actors.element.querySelector(selector));
            if (ui.actors._popout) {
                this.swapIcon(replacementInfo, ui.actors._popout.element.querySelector(selector));
            }
        }
    }

    /**
     * Checks an actor to see if its name should be replaced
     * @param {Actor} actor
     * @returns {Boolean} shouldReplace
     */
    static shouldReplaceName(actor) {
        if (!actor) return false;
        if (actor.hasPlayerOwner) return false;

        let baseActor = Utils.getBaseActor(actor);
        const dispositionEnum = baseActor.prototypeToken.disposition;
        const disposition = Utils.getKeyByValue(CONST.TOKEN_DISPOSITIONS, dispositionEnum);
        const hideSetting = Utils.getSetting(SETTING_KEYS[`hide${disposition.titleCase()}`]);
        const nameHiddenOverride = Utils.getModuleFlag(baseActor, FLAGS.nameHiddenOverride);
        const shouldReplace = nameHiddenOverride ?? hideSetting;

        return !!shouldReplace;
    }

    /**
     * For a given actor, find out if there is a replacement name and return it
     * @param {*} actor
     * @returns {String} replacementName
     */
    static getReplacementName(actor) {
        let baseActor = Utils.getBaseActor(actor);
        const dispositionEnum = baseActor.prototypeToken.disposition;
        const disposition = Utils.getKeyByValue(CONST.TOKEN_DISPOSITIONS, dispositionEnum);
        const replacementSetting = Utils.getSetting(SETTING_KEYS[`${disposition.toLowerCase()}NameReplacement`]);
        const replacementNameOverride = Utils.getModuleFlag(baseActor, FLAGS.replacementNameOverride);
        let replacementName = replacementNameOverride ?? replacementSetting;
        let tokenName = actor.token?.__name ?? actor.token?.name;
        let protoName = actor.prototypeToken?.__name ?? actor.prototypeToken?.name;
        replacementName = tokenName ? tokenName.replace(protoName, replacementName) : replacementName;

        return replacementName;
    }

    /**
     * For a given actor, find out if there is a replacement name and return it
     * @param {*} actor
     * @returns {String} replacementName
     */
    static getReplacementInfo(actor, defaultName) {
        let returnObject = {
            displayName: defaultName ?? actor.token?.name ?? actor.name,
            replacementName: HideNPCNames.getReplacementName(actor),
            shouldReplace: HideNPCNames.shouldReplaceName(actor)
        };

        returnObject.displayName = (!returnObject.shouldReplace || game.user.isGM || actor.isOwner ) ? returnObject.displayName : returnObject.replacementName;
        return returnObject;
    }

    /**
     * Generates the html for the show/hide icon
     * @param {*} shouldReplace
     * @param {*} replacementName
     * @returns {String} icon html
     */
    static getHideIconHtml({shouldReplace, replacementName}) {
        const title = `${shouldReplace
            ? `${game.i18n.localize(`HNN.MessageIcon.Title.NameHiddenPrefix`)} ${replacementName} ${game.i18n.localize(`HNN.MessageIcon.Title.NameHiddenSuffix`)}`
            : game.i18n.localize(`HNN.MessageIcon.Title.NameNotHidden`)}`;

        const icon = document.createElement("a");
        icon.classList.add("hide-name");
        icon.innerHTML = `<span class="fa-stack fa-1x hide-icon" title="${title}"><i class="fas fa-mask fa-stack-1x"></i>
        ${!shouldReplace ? `<i class="fas fa-slash fa-stack-1x"></i>` : ""}</span>`;
        return icon;
    }

    /**
     * Changes the icon html to the correct icon
     * @param {*} shouldReplace
     * @param {*} icon
     */
    static swapIcon({ shouldReplace, replacementName }, actorEntry) {
        let icon = actorEntry.querySelector(".hide-name");
        const title = `${shouldReplace
            ? `${game.i18n.localize(`HNN.MessageIcon.Title.NameHiddenPrefix`)} ${replacementName} ${game.i18n.localize(`HNN.MessageIcon.Title.NameHiddenSuffix`)}`
            : game.i18n.localize(`HNN.MessageIcon.Title.NameNotHidden`)}`;

        icon.innerHTML = `<span class="fa-stack fa-1x" title="${title}"><i class="fas fa-mask fa-stack-1x"></i>
        ${!shouldReplace ? `<i class="fas fa-slash fa-stack-1x"></i>` : ""}</span></a>`;
    }
}