# Hide NPC Names

This module for Foundry VTT allows you to replace NPC names with an alternative of your choice. You can choose to hide names for friendly, neutral, hostile, and secret dispositions independently. You can toggle the name of a specific actor manually by clicking the reveal button <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/mask.svg" width="15" height="15"> next to their name.

##### GM View:
<img src="https://github.com/ddbrown30/hide-npc-names/blob/main/gm_view.webp" width="500">

##### Player View:
<img src="https://github.com/ddbrown30/hide-npc-names/blob/main/player_view.webp" width="500">

### Actor Menu:
If you want more direct control over a specific actor, open its actor sheet and click the mask icon in the upper left corner.

<img src="https://github.com/ddbrown30/hide-npc-names/blob/main/actor_sheet.webp" width="500">

This will open a menu that allows you to set the hidden state of the actor and to override the replacement name.

<img src="https://github.com/ddbrown30/hide-npc-names/blob/main/actor_menu.webp" width="500">

### API:
Most modules should not need to do anything to benefit from Hide NPC Names but there are some edge cases if they are adding names manually to places like chat messages. For those that need it, they can use `game.hnn.getReplacementInfo(actor)` to get the current replacement info object for a given actor. In almost all cases, simply using `const actorName = game.hnn.getReplacementInfo(actor).displayName` should be all you need to do.

* `replacementInfo`
  * `displayName` The current desired display name of the actor. This will already be set based on the user, their permissions, and the hidden state of the actor. 99% of the time, this is all a module needs to use.
  * `replacementName` This is the replacement name that is shown when needed. You can treat this almost as a const value i.e. it does not change. It should be rare that any module would ever want to use this value directly.
  * `shouldReplace` True when we want to use the replacementName. This is already checked when setting `displayName`. You would only ever need to check this if you want to have custom display or handling for hidden names e.g. completely hiding an element in your UI.