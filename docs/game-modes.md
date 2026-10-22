# Game modes

Lobby and leaderboard order: Daily, All models, Company, Category, Region, Custom. Company sits above Category in both places.

## Company

The player picks one company, the same kind of list as the difficulties today.

The list shows every company: logo on the left, name, and how many models it has.

The leaderboard drops the difficulty dropdown and uses companies instead. Each option shows the logo and the name. The default is All companies. The chip on the right of a row shows the company.

Hints are the year and the size only. The company and its region are already known, so those are not offered. A round can also be played with no hints. A round already open keeps the rules it started with.

## Category

Categories are created by hand and stored in the database. Do not automatically create All US models, All Chinese models, or All European models. If those sets are wanted, they are ordinary categories created in the admin.

A category has a name, a short description, and an icon in place of a company logo. The icon is a company logo already stored in the database, an uploaded image, or one emoji. The same icon is what the lobby and the leaderboard show.

On `/play`, choosing Category swaps the usual list for a searchable dropdown. Each option shows the icon, the name, the description, and the number of turned-on models. Typing filters by name and description, and the arrow keys, Enter, and Escape work. A category with fewer than 2 turned-on models is not listed. A turned-off model does not count in a category. Choosing one starts the round at once. A round already open on that category resumes instead.

Hints can be bought as in All models: company, region, year, and size, because a category can mix labs. A round can also be played with no hints, and the no-hint multiplier applies. There is no difficulty. A player can have one open round per category.

The leaderboard lists every category with finished rounds. The default is All categories, and the chip on the right of a row shows the category icon and name. Choosing one category narrows the board to it. This applies to the leaderboard on the main page and on the leaderboard page.

## Region

One random model from the whole roster. Ten messages. One guess: US, Chinese, or European.

The lobby description should say that plainly.

No leaderboard. No hints. No difficulties. The result is not shareable. There is no score. The card shows the model, and says the guess was right or wrong.

## Custom

The player searches and selects the models in the pool, then can play with hints or without.

No leaderboard. The result can be shared. The card says the mode is Custom, and where a difficulty would be it says how many models were in the pool.
