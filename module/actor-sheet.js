/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
import {PlayerRollDialog} from "./playerRollDialog.js";
import {PlayerAttributeRollDialog} from "./playerAttributeRollDialog.js";
import {Capitalize, TypeNames} from "./misc.js";


export class GodboundActorSheet extends ActorSheet {

  /** @override */
	static get defaultOptions() {
	  return mergeObject(super.defaultOptions, {
  	  classes: ["godbound", "sheet", "actor"],
      width: 600,
      height: 700,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "attrs"}],
      dragDrop: [{dragSelector: ".item-list .item", dropSelector: null}]
    });
  }

  get template() {
    const path = "systems/godbound/templates/actor";
    return `${path}/${this.actor.data.type}-sheet.html`;
  }
  /* -------------------------------------------- */

  /** @override */
  getData() {
    const data = super.getData();
    data.dtypes = ["String", "Number", "Boolean"];
    return data;
  }

  /* -------------------------------------------- */
  /** @override */
  _onEditImage(event) {
    const attr = event.currentTarget.dataset.edit;
    let original = getProperty(this.actor.data, attr);
    let current = original;
    let activeSource = null;
    if(!game.user.isGM) {
      current = `player-home/${game.user.name}`;
      activeSource = 'data';
    }
    let options = {
      type: "image",
      current: original,
      callback: path => {
        event.currentTarget.src = path;
        this._onSubmit(event);
      },
      top: this.position.top + 40,
      left: this.position.left + 10
    };
    if(activeSource) {
      options.activeSource = activeSource;
    }
    new FilePicker(options).browse(current);
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    html.find('.item-name').click(ev => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    html.find('.item-pdf').click(ev => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data("itemId"));
      this.actor.demonstrateDoc(item);
    });

    html.find('.item-chat').click(ev => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data("itemId"));
      this.actor.demonstratePower(item);
    });

    html.find('.item-day-effort').click(ev => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data("itemId"));
      this.actor.commitEffortForDay(item);
    });

    html.find('.item-scene-effort').click(ev => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data("itemId"));
      this.actor.commitEffortForScene(item);
    });

    html.find('.item-atWill-effort').click(ev => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data("itemId"));
      this.actor.commitEffortAtWill(item);
    });

    html.find('.itemAdder').click(async ev => {
      const $i = $(ev.currentTarget);
      this.actor.createEmbeddedDocuments("Item", [{name: TypeNames($i.data('itemType')), type: $i.data('itemType')}], {renderSheet: true});
    });

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
      li.slideUp(200, () => this.render(false));
    });

    html.find('.effortSpend').click(ev => {
      const $i = $(ev.currentTarget);
      let effortCategory = $i.data('effortCategory');
      let effortChange = parseInt($i.data('effortChange'));
      if(effortChange > 0 && this.actor.canSpendEffort(effortChange)) {
        this.actor.update({data: {effort: {[effortCategory]: this.actor.data.data.effort[effortCategory] + effortChange}}});
      } else if(effortChange < 0 && this.actor.canReclaimEffort(effortChange, effortCategory)) {
        this.actor.update({data: {effort: {[effortCategory]: this.actor.data.data.effort[effortCategory] + effortChange}}});
      }
    });

    html.find('.attr-roll').click(ev => {
      let attr = $(ev.currentTarget).data('attr');
      PlayerAttributeRollDialog.create(this.actor, {rollType: `${Capitalize(attr)} check`}, async (data) => {
        let template = 'systems/godbound/templates/chat/attr-roll-result.html';
        let chatData = {
          user: game.user.id,
          speaker: this.actor.token ? {
            token: this.actor
          } : {
            actor: this.actor
          },
        };
        let templateData = {
          title: 'Attribute Check',
          details: `${Capitalize(attr)} - ${data.modifier == -8 ? 'Very hard' : data.modifier < 0 ? 'Hard' : data.modifier > 0 ? 'Easy' : 'Normal'}`,
          data: data,
        }
        let roll = new Roll('1d20 + @difficulty + @factModifier', {
          attr: this.actor.data.data.attributes[attr].score,
          difficulty: data.modifier,
          factModifier: data.factModifier,
        });
        roll.roll({async:false});
        let target = 21 - this.actor.data.data.attributes[attr].score;
        let result = {
          isSuccess: roll.total >= target,
          isFailure: roll.total < target,
          target: target,
        }
        result.className = result.isSuccess ? 'result-msg-success' : 'result-msg-failure';
        templateData.roll = await roll.render();
        templateData.result = result;
        templateData.data.actor = this.actor;
        chatData.content = await renderTemplate(template, templateData);
        chatData.roll = roll;
        chatData.isRoll = true;
        // Dice So Nice
        if (game.dice3d) {
          await game.dice3d.showForRoll(
            roll,
            game.user,
            true,
            chatData.whisper,
            chatData.blind
          );
          ChatMessage.create(chatData);
        } else {
          chatData.sound = CONFIG.sounds.dice;
          ChatMessage.create(chatData);
        }
      });
    })

    html.find('.attack-roll').click(async ev => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data("itemId"));
      this.actor.rollAttack(item);
    });

    html.find('.morale-roll').click(async ev => {
      this.actor.rollMorale();
    });

    html.find('.autoattack-roll').click(ev => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data("itemId"));
      this.actor.rollDamage(item)
    });

     html.find('.save-roll').click(ev => {
      let save = $(ev.currentTarget).data('save');
     PlayerRollDialog.create(this.actor, {rollType: `${Capitalize(save)} save`}, async (data) => {
        let template = 'systems/godbound/templates/chat/saving-throw-result.html';
        let chatData = {
          user: game.user.id,
          speaker: this.actor.token ? {
            token: this.actor
          } : {
            actor: this.actor
          },
        };
        let templateData = {
          title: 'Saving Throw',
          details: `${Capitalize(save)} - ${data.modifier < 0 ? 'Hard' : data.modifier > 0 ? 'Easy' : 'Normal'}`,
          data: data,
        }
        let roll = new Roll('1d20 + @difficulty', {
          difficulty: data.modifier,
        });
        roll.roll({async:false});
        let target = this.actor.data.data.computed.saves[save].save;
        let result = {
          isSuccess: roll.total >= target,
          isFailure: roll.total < target,
          target: target,
        }
        result.className = result.isSuccess ? 'result-msg-success' : 'result-msg-failure';
        templateData.roll = await roll.render();
        templateData.result = result;
        templateData.data.actor = this.actor;
        chatData.content = await renderTemplate(template, templateData);
        chatData.roll = roll;
        chatData.isRoll = true;
        // Dice So Nice
        if (game.dice3d) {
          await game.dice3d.showForRoll(
            roll,
            game.user,
            true,
            chatData.whisper,
            chatData.blind
          );
          ChatMessage.create(chatData);
        } else {
          chatData.sound = CONFIG.sounds.dice;
          ChatMessage.create(chatData);
        }
      });
    })

    html.find('#hpdmg').click(async ev => {
      let adjStr = html.find('#hpadjust').val();
      let adj = parseInt(adjStr);
      if(String(adj) !== adjStr || adj < -1) {
        ui.notifications.error("HP Adjustment Value must be a positive number");
        return;
      }
      html.find('#hpadjust').val('0');
      await this.actor.applyDamage(adj);
    });

    html.find('#hddmg').click(async ev => {
      let adjStr = html.find('#hdadjust').val();
      let adj = parseInt(adjStr);
      if(String(adj) !== adjStr || adj < -1) {
        ui.notifications.error("HD Adjustment Value must be a positive number");
        return;
      }
      html.find('#hdadjust').val('0');
      await this.actor.applyHDDamage(adj);
    });

    html.find('#chooseTactic').click(ev => {
      console.log(this.actor.items);
      let tactics = this.actor.items.filter(i =>
        i.data.type === 'tactic'
      );

      if(tactics.length > 0) {
        var chosen = tactics[Math.floor(Math.random() * tactics.length)];
        console.log(chosen);
        html.find('#chosenTactic #chosenTactic-name').text(`${chosen.name} -`);
        html.find('#chosenTactic #chosenTactic-desc').text(chosen.data.data.description);
      }
    });
    html.find('#chosenTactic').click(ev => {
      html.find('#chosenTactic #chosenTactic-name').text('');
      html.find('#chosenTactic #chosenTactic-desc').text('');
    });
  }
}