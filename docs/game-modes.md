# Game modes

Lobby and leaderboard order: Daily, All models, Company, Category, Origin, Custom. Company sits above Category in both places.

## Company

The player picks one company, the same kind of list as the difficulties today.

The list shows every company: logo on the left, name, and how many models it has.

The leaderboard drops the difficulty dropdown and uses companies instead. Each option shows the logo and the name. The default is All companies. The chip on the right of a row shows the company.

Hints are the year and the size only. The company and its origin are already known, so those are not offered. A round can also be played with no hints. A round already open keeps the rules it started with.

## Category

Categories are created by hand and stored in the database. Do not automatically create All US models, All Chinese models, or All European models. If those sets are wanted, they are ordinary categories created in the admin.

A category has a name, a short description, and an icon in place of a company logo. The icon is a company logo already stored in the database, an uploaded image, or one emoji. The same icon is what the lobby and the leaderboard show.

On `/play`, choosing Category swaps the usual list for a searchable dropdown. Each option shows the icon, the name, the description, and the number of turned-on models. Typing filters by name and description, and the arrow keys, Enter, and Escape work. A category with fewer than 2 turned-on models is not listed. A turned-off model does not count in a category. Choosing one starts the round at once. A round already open on that category resumes instead.

Hints can be bought as in All models: company, origin, year, and size, because a category can mix labs. A round can also be played with no hints, and the no-hint multiplier applies. There is no difficulty. A player can have one open round per category.

The leaderboard lists every category with finished rounds. The default is All categories, and the chip on the right of a row shows the category icon and name. Choosing one category narrows the board to it. This applies to the leaderboard on the main page and on the leaderboard page.

## Origin

One random model from the whole roster. Ten messages. One guess: where does this model come from?

The lobby sentence is **Ten messages, one guess: where does this model come from?**

The player does not name the model. The buttons are every origin that is turned on in the `origins` table, each with its flag and name, such as 🇺🇸 USA. Today they are USA, China, and Europe, but nothing in the code is fixed to three. Choosing an origin selects it. **Submit guess** sends it. There is only one guess per round, and it can be sent after any reply.

The pool is every turned-on model whose origin is turned on. At least two origins must be in that pool, or the round does not start. An origin that is turned off has no button and none of its models is drawn. It changes nothing in the other modes, and the origin hint still works there.

No leaderboard. No hints. No difficulty, no category, and no hint choice, so choosing Origin on `/play` starts the round at once. The result is solved, failed, or given up. There is no score.

The result is shareable. The card shows the model and what the player guessed. When the guess was wrong, or the round was given up, it also says where the model comes from. The on-site card, the public page, the link preview, and the downloaded PNG all say the same thing.

Origins are never deleted. An admin adds them, renames them, and turns them on or off.

The statistics page has an Origin view: solve rate, how often each real origin was found, how many times each origin was picked, and the hardest and easiest models. Origin rounds are left out of the All modes figures, because nobody names a model in them.

## Custom

The player searches and selects the models in the pool, then can play with hints or without.

No leaderboard. The result can be shared. The card says the mode is Custom, and where a difficulty would be it says how many models were in the pool.
