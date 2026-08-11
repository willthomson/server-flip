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

## Learning projects (no configuration)

Both your staging and local builds render a `<link rel="canonical">` pointing at the
production hostname. Two different origins emitting the same canonical hostname are,
by definition, the same project – so Server Flip uses that hostname as a key and
learns pairs as you click:

1. Click the icon on a staging page. The extension reads the canonical, stores the
   staging origin under that project's key, and – if it already knows a local side
   (learnt or from the fallback fields) – flips immediately. Otherwise the badge
   shows `1/2`: half a pair learnt.
2. Click it on the same project locally. Same canonical hostname, same key – the
   local side is stored and the tab flips. From then on, one click works in either
   direction, on every page of that project.

Only the *hostname* of the canonical is used, never its path. Environments often
disagree about the path in their canonical tags (one may include a section prefix
the other omits); the production hostname is stable across both.

Learnt pairs appear on the settings page with a Forget button each. When the same
localhost port has served several projects, the most recently used project wins for
the badge – and a click always re-reads the canonical, so the flip itself can't go
to the wrong project.

## Fallback settings

Two fields for anything without a canonical tag, both forgiving about what you paste in:

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

- On a page with a canonical tag: identifies the project, learns/updates the pair,
  and flips if it knows the other side.
- First click on a brand-new project: badge flashes `1/2` – click once on the other
  server to complete the pair.
- On a page without a canonical: falls back to plain origin matching against learnt
  pairs and the fallback fields.
- On anything unrecognised: badge flashes `?` so you know the click registered.
- Before anything is configured or learnt: the click opens the settings page.

## Sharing it with the team

Send them the zip and point them at the install steps above. Everyone configures their
own origins, so there's nothing to coordinate.

If you'd rather not do the developer-mode dance on every machine, the alternatives are
publishing privately to the Chrome Web Store (one-off $5 developer fee, unlisted
visibility) or, if the agency manages Chrome via Google Workspace, force-installing it
through an admin policy.

## Permissions

It asks for `tabs`, `storage`, `scripting` and `activeTab`.

Chrome will describe `tabs` as *"Read your browsing history"*, which sounds worse than
it is – it's needed to read the current tab's URL so the badge can show which server
you're on without you clicking first. `scripting` + `activeTab` let the extension read
the canonical tag of the page you clicked on – that one tab, at that one moment, only,
and they add no install warning. The extension makes no network requests and sends
nothing anywhere. The whole thing is small enough to read in one sitting.

## Files

```
manifest.json     Manifest V3
background.js     Service worker: click handling, keyboard command, badge state
lib/origin.js     Shared parsing – toOrigin / classify / swap
options.html/css/js   Settings page
icons/            Generated PNGs at 16/32/48/128
```

## Ideas if it earns its keep

- **A third environment.** Prod as well as staging would need a popup or a cycle order,
  since one click can only go one way.
- **Export/import of learnt pairs**, for teams that want to share a starting set.
