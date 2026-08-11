# Server Flip

Click the toolbar icon to bounce the current tab between your staging and local dev
servers. Path, query string and hash come along for the ride; only the origin changes.

```
https://staging.example.dev/blog/some-long-post-slug/?preview=true
                    ⇅
http://localhost:4007/blog/some-long-post-slug/?preview=true
```

The badge tells you where you are without looking at the address bar: amber **S** on
staging, green **L** on local, nothing at all anywhere else.

## Install

1. Unzip somewhere permanent – Chrome loads it from disk every launch, so don't leave
   it in `~/Downloads` and then tidy up.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and pick the `server-flip` folder.
5. The settings page opens automatically. Fill in the two origins and save.
6. Pin the icon to the toolbar (puzzle-piece menu → pin).

To reopen settings later: right-click the icon → **Options**.

## Settings

Two fields, both forgiving about what you paste in:

| You type | It stores |
| --- | --- |
| `staging.example.dev` | `https://staging.example.dev` |
| `localhost:4007` | `http://localhost:4007` |
| `http://localhost:4007/blog/foo/?preview=true` | `http://localhost:4007` |

Bare hosts get `https://` unless they look like loopback, in which case `http://`.
Anything after the origin is discarded, so pasting a whole URL is fine.

Settings live in `chrome.storage.sync`, so they follow your Chrome profile across
machines. Each person on the team sets their own – handy when your local ports differ.

## Keyboard shortcut

`Alt+Shift+F` by default. Change it at `chrome://extensions/shortcuts`, or use the
button on the settings page.

## Behaviour

- On a matching origin: navigates the current tab to the other one.
- On any other site: nothing happens, and the badge flashes `?` for a second so you
  know the click registered.
- Before you've configured anything: the click opens the settings page.

## Sharing it with the team

Send them the zip and point them at the install steps above. Everyone configures their
own origins, so there's nothing to coordinate.

If you'd rather not do the developer-mode dance on every machine, the alternatives are
publishing privately to the Chrome Web Store (one-off $5 developer fee, unlisted
visibility) or, if the agency manages Chrome via Google Workspace, force-installing it
through an admin policy.

## Permissions

It asks for `tabs` and `storage`.

Chrome will describe `tabs` as *"Read your browsing history"*, which sounds worse than
it is – it's needed to read the current tab's URL so the badge can show which server
you're on without you clicking first. The extension makes no network requests and
sends nothing anywhere. All 300-odd lines are in front of you if you want to check.

## Files

```
manifest.json     Manifest V3
background.js     Service worker: click handling, keyboard command, badge state
lib/origin.js     Shared parsing – toOrigin / classify / swap
options.html/css/js   Settings page
icons/            Generated PNGs at 16/32/48/128
```

## Ideas if it earns its keep

- **More than one pair.** Right now it's a single staging↔local mapping. Swapping
  `staging`/`local` strings for an array of pairs, then matching the current origin
  against every entry, would cover the whole monorepo. The matching logic in
  `lib/origin.js` barely changes.
- **A third environment.** Prod as well as staging would need a popup or a cycle order,
  since one click can only go one way.
- **Port autodetect.** If your dev server port moves about, the extension could remember
  the last localhost port you visited instead of hard-coding one.
