import * as MODULE_CONFIG from "./config.js";
import { Utils } from "./utils.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ActorForm extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "hide-names-actor",
        tag: "form",
        classes: ["hide-name"],
        window: { title: "HNN.ActorForm.Title" },
        position: { width: "700", height: "auto" },
        form: {
            handler: ActorForm.formHandler,
            submitOnChange: false,
            closeOnSubmit: true
        },
        actions: {
            save: function () { this.submit(); this.close(); },
            clear: async function () { await this.onClickClear(); },
            cancel: function () { this.close(); }
        },
    };

    constructor(object, options = {}) {
        super(object, options);
        this.baseActor = Utils.getBaseActor(object);
    }

    static PARTS = {
        form: {
            template: MODULE_CONFIG.DEFAULT_CONFIG.templates.actorForm,
        }
    };

    async _prepareContext(options) {
        const baseActor = this.baseActor;
        const dispositionEnum = baseActor?.prototypeToken?.disposition;
        const disposition = Utils.getKeyByValue(CONST.TOKEN_DISPOSITIONS, dispositionEnum);
        const dispositionString = game.i18n.localize(`TOKEN.DISPOSITION.${disposition}`);
        const hideSetting = Utils.getSetting(MODULE_CONFIG.SETTING_KEYS[`hide${disposition.titleCase()}`]);
        const hideSettingString = hideSetting ? game.i18n.localize("HNN.ActorForm.Hidden") : game.i18n.localize("HNN.ActorForm.Revealed");
        const nameHiddenOverride = Utils.getModuleFlag(baseActor, MODULE_CONFIG.FLAGS.nameHiddenOverride);
        const nameHidden = nameHiddenOverride ?? hideSetting;
        const replacementSetting = Utils.getSetting(MODULE_CONFIG.SETTING_KEYS[disposition.toLowerCase() + `NameReplacement`]);
        const replacementNameOverride = Utils.getModuleFlag(baseActor, MODULE_CONFIG.FLAGS.replacementNameOverride);
        const replacementName = replacementNameOverride ?? replacementSetting;

        return {
            nameHidden,
            hideSettingString,
            dispositionString,
            replacementName
        };
    }

    /**
     * Save button click handler
     * @param {*} event
     */
    async onClickClear() {
        await this.baseActor.update({
            [`flags.${MODULE_CONFIG.NAME}.${MODULE_CONFIG.FLAGS.nameHiddenOverride}`]: _del,
            [`flags.${MODULE_CONFIG.NAME}.${MODULE_CONFIG.FLAGS.replacementNameOverride}`]: _del
        });
        this.close();
    }

    /**
     * Update the object on submit
     * @param {*} formData
     */
    static async formHandler(event, form, formData) {
        const hideName = formData.object[`hide-name`];
        const replacementName = formData.object[`replacement-name`];

        await this.baseActor.update({
            [`flags.${MODULE_CONFIG.NAME}.${MODULE_CONFIG.FLAGS.nameHiddenOverride}`]: hideName ?? false,
            [`flags.${MODULE_CONFIG.NAME}.${MODULE_CONFIG.FLAGS.replacementNameOverride}`]: replacementName ?? null
        });
    }
}