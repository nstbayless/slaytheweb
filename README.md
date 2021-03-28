# Slay the Web
 
This is a browser-based card game and engine based on Slay The Spire, a fantastic video game designed by [MegaCrit](https://www.megacrit.com/):

> We fused card games and roguelikes together to make the best single player deckbuilder we could. Craft a unique deck, encounter bizarre creatures, discover relics of immense power, and Slay the Spire!

🎴 Play it on https://slaytheweb.cards/

![Screenshot of the game](https://i.imgur.com/m9CRCsa.png)

Why what? After many runs in the Spire, I really got into the theory behind the game. Inspired by the STS modding community, I thought it'd be neat and a great learning experience to try and implement the core logic of the game in JavaScript for the web. And that is what _Slay the Web_ is: a kind of stable, UI agnostic game engine and an example UI for the web.

## How to work on the code 

Besides project config, everything is in the `public` folder. This is the web root, requires no compilation and can be opened or deployed to a web browser.

First, the game logic itself. Which, again, does not know about UI. It is only concerned with modifying the game state.

- The `public/game` folder contains the game engine
- The `public/content` folder uses the game engine to create example cards, dungeons and monsters 
- The `public/index.html` and `public/ui` is an example interface/website
- The `public/web_modules` folder contains 3rd party dependencies
- The `tests` folder is filled with tests for the game

You can open the `public` folder with a browser, or if you want livereload, run `npm start`. If [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) is installed, these commands should set up a development environment:

```
# install and use the latest stable node version
nvm install --lts && nvm use --lts
# install project dependencies
npm install
# get yarn (needed for testing and formating)
npm install -g yarn
```

### Testing

Scripts are checked with eslint, formatted with prettier and tested with ava.

Additionally the `./tests` folder contains the tests. Usually a test goes 1) create a game 2) modify the game state with one or more actions 3) assert that the final state is how it you expect.

- `yarn test` tests everything once
- `yarn test:watch` tests continously (good while developing)
- `yarn test:coverage` check test code coverage

Additionally you can run `yarn eslint public --fix` to automatically format all scripts according to the prettier standards.

### Deploying

The `main` branch automatically deploys to https://slaytheweb.cards via Zeit's now. If you open a PR, it'll give you a staging URL as well.

## How the game works

- https://kinopio.club/slay-the-web-Dh3xUjjHbol7RbCuqZQDn (could be outdated)

### Game state

The full game state is always stored in a single, large "game state" object. It is everything needed to reproduce a certain state of the game. Everything is synchronous. It does not care about your UI. The state is always modified using "actions". 

### Actions

An action is a function that takes a `state` object, modifies it, and returns a new one. There are actions for drawing a card, dealing damage, applying a debuff... everything you want to do, there's an action.

See all actions in `./public/game/actions.js`. Most have comments and corresponding tests you can check.

### Action Manager

As said, actions return a new state. They don't modify the original state. To keep track of all the moves (actions) made, we use the "action manager" to queue and dequeue them.

Run `enqueue(action)` to add an action to the list.  
Run `dequeue()` to update the state with the changes from the oldest action in the queue.

> Note, you don't pass an action directly to the action manager. Rather you pass an object. Like this: `{type: 'nameOfAction', damage: 5, ... more properties}`.

### Cards

You have a deck of cards. Cards have different energy cost and can trigge other game actions when they are played.

1. Cards start in the "draw pile".
2. From there they are drawn to the "hand"
3. ...and finally, once played, to the "discard pile".

Once the draw pile is empty, and you attempt to draw, the discard pile is reshuffled into the draw pile.

Cards also have a `target` property to suggest which targets the card should affect. Targets include `player`, `enemyX` (where x is the monster's index, starting from 0) and `all enemies`.

For more advanced cards, you can define (custom) actions to run when the card is played. To limit when a a card can be played, use "conditions" (see the source code).

### Powers

Cards can apply "powers". A power is a status effect or aura that usually lasts one or more turns. It can target the player, a monster or all enemies. A power could do literally anything, but an example is the "Vulnerable" power, which makes the target take 50% more damage for two turns.

As an example, setting `state.player.powers.weak = 5`, indicates that the player should be considered weak for five turns. Powers decrease by one stack per turn.

### Player

On `state.player` we have you, the player. This object describes the health, powers and the cards you have.

### Dungeon

Every game starts in a dungeon. You make your way through rooms to reach the end.

There are different types of rooms. Like Monster and Campfire. One day there'll be more like Merchant and Treasure or a "random" room.

### Monsters

Monsters exist inside the rooms in a dungeon. A monster has health and a list of "intents" that it will take each turn. These intents are basically the AI. Monsters can do damage, block and apply powers. It's not super flexible, as we're not using actions and cards like the player does. But it is enough for now.

## References

A collection of related links, inspiration and ideas.

- FTL, Into The Breach, Darkest Dungeon, Dungeon of the Endless, Spelunky, Rogue Legacy,
- [Pollywog Games: A history of roguelite deck building games](https://pollywog.games/rgdb/)
- http://stfj.net/index2.php?project=art/2011/Scoundrel.pdf
- http://stfj.net/index2.php?year=2018&project=art/2018/Pocket-Run%20Pool
- http://www.cardcrawl.com/
- http://www.cardofdarkness.com/
- https://freesound.org/
- https://game-icons.net/
- https://github.com/RonenNess/RPGUI
- https://hundredrabbits.itch.io/donsol [Source](https://github.com/hundredrabbits/Donsol/tree/master/desktop/sources/scripts)
- https://itch.io/games/tag-card-game/tag-roguelike
- https://nathanwentworth.itch.io/deck-dungeon [Source](https://github.com/nathanwentworth/deck-dungeon/)
- https://www.reddit.com/r/slaythespire/comments/a7lhpq/any_recommended_games_similar_to_slay_the_spire/
- https://twitter.com/fabynou/status/1212534790672408578
- https://www.gamasutra.com/blogs/JoshGe/20181029/329512/How_to_Make_a_Roguelike.php
- https://www.reddit.com/r/roguelikedev/
- https://www.reddit.com/r/roguelikes/
- https://klei.com/games/griftlands
- https://forgottenarbiter.github.io/Is-Every-Seed-Winnable/
- https://www.cloudfallstudios.com/blog/2020/11/2/game-design-tips-reverse-engineering-slay-the-spires-decisions
- https://www.cloudfallstudios.com/blog/2018/5/7/guide-deckbuilder-tips-for-beginners-prompts-for-the-experienced-part-23

### Slay the Spire modding, tools and things

- https://en.wikipedia.org/wiki/Slay_the_Spire
- https://slay-the-spire.fandom.com/wiki/Slay_the_Spire_Wiki
- https://spirelogs.com/
- https://maybelatergames.co.uk/tools/slaythespire/		
-	https://github.com/daviscook477/BaseMod
- https://github.com/Gremious/StS-DefaultModBase
-	https://github.com/Gremious/StS-DefaultModBase/wiki
- https://github.com/kiooeht/Hubris/
- https://github.com/kiooeht/StSLib/wiki/Power-Hooks
- https://www.gdcvault.com/play/1025731/-Slay-the-Spire-Metrics
- https://github.com/Dementophobia/slay-the-spire-sensei
- https://www.rockpapershotgun.com/2018/02/19/why-revealing-all-is-the-secret-of-slay-the-spires-success/
- [Slay the Spire Reference spreadsheet](https://docs.google.com/spreadsheets/u/1/d/1ZsxNXebbELpcCi8N7FVOTNGdX_K9-BRC_LMgx4TORo4/edit?usp=sharing)
- [Slay the Spire Discord](https://discord.gg/slaythespire)
- https://github.com/adnzzzzZ/blog
- https://forgottenarbiter.github.io/Is-Every-Seed-Winnable/ ([discussion](https://news.ycombinator.com/item?id=23910006))
- https://www.twitch.tv/telnetthespire
- [Slay the Spire Reference Spreadsheet](https://docs.google.com/spreadsheets/u/1/d/1ZsxNXebbELpcCi8N7FVOTNGdX_K9-BRC_LMgx4TORo4/edit#gid=1146624812)

### Open source artwork

Credits to http://ronenness.github.io/RPGUI/ and https://github.com/game-icons/icons for providing great and free graphics.
