// custom NukemNet support for proDuke written by LARD (phcs93)
module.exports = function({deepClone, utils, mainStore }, gamedefs) { // export default function produke({deepClone, utils}, xduke) {

    const fs = require("fs");
    const path = require("path");

    // clone xduke definitions as base
    const produke = deepClone(gamedefs.games.duke3d.executables.xduke); // deepClone(xduke);

    // remove arguments that have been moved to netflags
    delete produke.parameters.noMonsters;
    delete produke.parameters.respawn;

    // remove irrelevant fields
    delete produke.parameters.con;
    delete produke.parameters.grp;

    // change xduke to produke name and executable
    produke.name = "proDuke";
    produke.files.main.path = "produke.exe";
    produke.networking = { modes: ['p2p'], ipv6: true };

    // here we override how NN writes netlist.txt
    // we use the user's detected external ip instead of using a virtual interface (0.0.0.0 or [::])
    // this is "allegedly" a better approach for P2P networking
    produke.runnables.multiplayer.beforeRun = [{"cmd":"function", async run(ctx) {

        const ipv4 = mainStore.myExternalIpV4;
        const ipv6 = mainStore.myExternalIpV6;
        const port = ctx.GameRoom.MyPort;

        const netlistFileName = "netlist.txt";
        const nickToIpDetails = ctx.GameRoom.PlayersIpAndPorts;
        const othersIpDetails = Object.values(nickToIpDetails);

        let netlistText = "mode peer\r\n";
        let foundIpv6 = false;

        for (const ipd of othersIpDetails) {

            const entryIp = (() => {

                if (ipd.ip.includes(":")) {
                    foundIpv6 = true;
                    return `[${ipd.ip}]`;
                }

                return ipd.ip;

            })();

            netlistText += `allow ${entryIp}:${ipd.port}\r\n`

        }

        netlistText = `interface ${foundIpv6 ? `[${ipv6}]:${port}` : `${ipv4}:${port}`}\r\n` + netlistText; 
        
        fs.writeFileSync(path.resolve(ctx.GameDir, netlistFileName), netlistText);

    }}];

    // game mode
    produke.parameters.multiplayerMode.label = "Game Mode";
    produke.parameters.multiplayerMode.optional = false;
    produke.parameters.multiplayerMode.choices = [
        {label: "Dukematch (DM)", value: 1},
        {label: "Cooperative (COOP)", value: 2},
        {label: "Team Dukematch (TDM)", value: 3},
        {label: "Catch The Flag (CTF)", value: 4},
        {label: "1-Flag CTF (ONEFCTF)", value: 5},
        {label: "ATK/DEF CTF (ADCTF)", value: 6},
        {label: "Survival (SURV)", value: 7},
        {label: "Last Man Standing (LMS)", value: 8},
        {label: "Team Last Man Standing (TLMS)", value: 9},
        {label: "Terminator (TERM)", value: 10}
    ];
    produke.parameters.multiplayerMode.dependsOn = {
        params: "multiplayerMode", 
        show: async c => {            
            if (c?.ParamEl?.multiplayerMode) {
                const element = document.getElementById("game-param-multiplayerMode");
                if (!element.dataset.listening) {
                    element.dataset.listening = true;
                    element.addEventListener("input", e => {
                        const selectedGameMode = parseInt(e.target.value);
                        const selectedPreset = document.getElementById("game-param-presets").value.replace(/\"/g, "");
                        applyPreset(selectedPreset, selectedGameMode);
                    });
                }                    
            }
            return true;
        }
    }

    // skill
    produke.parameters.monstersSkill.label = "Skill";
    produke.parameters.monstersSkill.type = "choice";    
    produke.parameters.monstersSkill.dependsOn = null;
    produke.parameters.monstersSkill.value = c => c.value > 0 ? "/s" + c.value : null;
    produke.parameters.monstersSkill.optional = false;
    produke.parameters.monstersSkill.choices = [
        //{label: "No Monsters", value: 0},
        {label: "Piece Of Cake", value: 1},
        {label: "Let's Rock", value: 2},
        {label: "Come Get Some", value: 3},
        {label: "Damn I'm Good", value: 4}
    ];

    // map type (original or user)
    produke.parameters.mapType = {
        modeSupport: ["multiplayer", "singleplayer"],
        type: "choice",
        label: "Map Type",
        optional: false,
        syncOnly: true,
        choices: [
            {label: "Original Map", value: "original"},
            {label: "User Map", value: "user"}
        ]
    };

    // original map
    produke.parameters.episodeAndLevel.label = "Map";
    produke.parameters.episodeAndLevel.optional = false;
    produke.parameters.episodeAndLevel.dependsOn = {
        params: "mapType", 
        show: c => c?.ParamEl?.mapType === "original"
    };

    // user map
    produke.parameters.map.label = "Map";
    produke.parameters.map.optional = false;
    produke.parameters.map.dependsOn = {
        params: "mapType", 
        show: c => c?.ParamEl?.mapType === "user"
    };

    // score limit
    produke.parameters.scoreLimit = {
        modeSupport: ["multiplayer", "singleplayer"],
        type: "numrange",
        label: "Score Limit",
        min: 0,
        max: 99,
        delta: 1,
        optional: false,
        value: c => parseInt(c.value) > 0 ? `/y${c.value}` : null
    };

    // time limit
    produke.parameters.timeLimit = {
        modeSupport: ["multiplayer", "singleplayer"],
        type: "numrange",
        label: "Time Limit",
        min: 0,
        max: 240,
        delta: 1,
        optional: false,
        value: c => parseInt(c.value) > 0 ? `/k${c.value}` : null
    };

    // extra lives
    produke.parameters.extraLives = {
        modeSupport: ["multiplayer", "singleplayer"],
        type: "numrange",
        label: "Extra Lives",
        min: 0,
        max: 9,
        delta: 1,
        optional: false,
        value: c => parseInt(c.value) > 0 ? `/e${c.value}` : null,
        dependsOn: {
            params: "multiplayerMode", 
            show: c => c?.ParamEl?.multiplayerMode && [7,8,9].includes(c.ParamEl.multiplayerMode)
        }
    };

    // bots
    produke.parameters.botsNum.label = "BOTs";
    produke.parameters.botsNum.optional = false;
    produke.parameters.botsNum.min = 0;
    produke.parameters.botsNum.max = 16;

    // bot ai
    produke.parameters.botsAi.label = "BOTs AI";
    produke.parameters.botsAi.optional = false;
    produke.parameters.botsAi.dependsOn = null;

    // record demo
    produke.parameters.recordDmo.label = "Record Demo";
    produke.parameters.recordDmo.for = "private";

    // play demo
    produke.parameters.playDmo.label = "Play Demo";
    produke.parameters.playDmo.optional = false;

    // color
    produke.parameters.color = {
        modeSupport: ["multiplayer", "singleplayer"],
        type: "choice",
        label: "Color",
        optional: false,
        for: "private",
        value: ["-color", c => c.value],
        choices: [
            {label: "Auto", value: "0"},
            {label: "Blue", value: "1"},
            {label: "Red", value: "2"},
            {label: "Green", value: "3"},
            {label: "Gray", value: "4"},
            {label: "Dark Gray", value: "5"},
            {label: "Dark Green", value: "6"},
            {label: "Brown", value: "7"},
            {label: "Dark Blue", value: "8"},
            {label: "Bright Red", value: "9"},
            {label: "Dark Brown", value: "10"},
            {label: "Cement", value: "11"},
            {label: "Black", value: "12"},
            {label: "Off White", value: "13"},
            {label: "Orange", value: "14"},
            {label: "Yellow", value: "15"},
            {label: "Purple", value: "16"}
        ],
        dependsOn: {
            params: "multiplayerMode", 
            show: c => c?.ParamEl?.multiplayerMode && ![3,4,5,6,9].includes(c.ParamEl.multiplayerMode)
        }
    };

    // team
    produke.parameters.team = {
        modeSupport: ["multiplayer", "singleplayer"],
        type: "choice",
        label: "Team",
        optional: false,
        for: "private",
        value: ["-team", c => c.value],
        choices: [
            {label: "Blue", value: "1"},
            {label: "Red", value: "2"},
            {label: "Green", value: "3"},
            {label: "Brown", value: "4"}
        ],
        dependsOn: {
            params: "multiplayerMode", 
            show: c => c?.ParamEl?.multiplayerMode && [3,4,5,6,9].includes(c.ParamEl.multiplayerMode)
        }
    };

    // spectator
    produke.parameters.spec = {
        modeSupport: ["multiplayer", "singleplayer"],
        type: "boolean",
        label: "Spectator",
        optional: false,
        value: "-spec",
        for: "private"
    };

    // lock options
    produke.parameters.lockOptions = {
        modeSupport: ["multiplayer"],
        type: "boolean",
        label: "Lock Options",
        optional: false,
        value: "/lockoptions",
        for: "host-only-private"
    };

    // lock players
    produke.parameters.lockPlayers = {
        modeSupport: ["multiplayer"],
        type: "boolean",
        label: "Lock Players",
        optional: false,
        value: "/lockplayers",
        for: "host-only-private"
    };

    // lock specs
    produke.parameters.lockSpecs = {
        modeSupport: ["multiplayer"],
        type: "boolean",
        label: "Lock Spectators",
        optional: false,
        value: "/lockspecs",
        for: "host-only-private"
    };

    // disable autoaim
    produke.parameters.disableAutoaim = {
        modeSupport: ["multiplayer", "singleplayer"],
        type: "boolean",
        label: "Disable Autoaim",
        optional: false,
        value: "/disableautoaim",
        for: "private"
    };

    // exploit mode
    produke.parameters.exploitMode = {
        modeSupport: ["multiplayer", "singleplayer"],
        type: "boolean",
        label: "Exploit Mode",
        optional: false,
        value: "/exploitmode",
        for: "private"
    };

    // allow mods
    produke.parameters.allowMods = {
        modeSupport: ["multiplayer", "singleplayer"],
        type: "boolean",
        label: "Allow Mods",
        optional: false,
        value: "/allowmods",
        for: "private"
    };

    // master/slave
    produke.parameters.masterSlave = {
        modeSupport: ["multiplayer"],
        type: "boolean",
        label: "Master/Slave",
        optional: false,
        value: "/i0",
        for: "host-only-private"
    };

    // send -master automatically if /lockoption or /lockplayers or /i0 is set
    produke.parameters["master"] = {
        modeSupport: ["multiplayer"],
        type: "static",
        for: "host-only-private",
        value: "-master",
        addIf: c => {
            const p = c.GameRoom.Params;
            return p.lockOptions || p.lockPlayers || p.masterSlave;
        }        
    };

    // send /teampicker automatically if any team based mode is selected
    produke.parameters["teampicker"] = {
        modeSupport: ["singleplayer", "multiplayer"],
        type: "static",
        value: "/teampicker",
        addIf: c => {
            return [3,4,5,6,9].includes(parseInt(c.GameRoom.Params.multiplayerMode[0].replace("/c", "")));
        }
    };

    // netflags definitions
    const netflags = {
        netflagsA: {
            "Weapons Pickable Once": 1,
            "Respawn Monsters": 2,
            "Respawn Items": 4,
            "Respawn Inventory": 8,
            "Markers": 16,
            "Don't Spawn Monsters": 32,
            "Don't Spawn Keycards": 64,
            "Spawn DM Only Switches": 128,
            "Spawn MP Only Items": 256,
            "[COOP/TEAMS] Friendly Fire": 512,
            "[COOP/TEAMS] Autoaim On Allies": 1024,
            "[COOP/TEAMS] Global Ally Sounds": 2048,
            "[COOP/TEAMS] No Spycam/Mapview": 4096,
            "Revealed Automap": 8192,
            "No Map Exit": 16384,
            "No Target Names": 32768,
            "Weapon Always Drops On Kill": 65536,
            "Force Respawn": 131072,
            "[PVP] Respawn Farthest": 262144,
            "[TEAMS] Mixed Team Spawn Points": 524288,
            "Damage Numbers": 1048576,
            "[COOP/TEAMS/TERM] Overhead Info": 2097152,
            "[COOP/TEAMS/TERM] Outlines": 4194304,
            "[CTF] Outline On Flags": 8388608,
            "[CTF] Flag Return Instantly": 16777216,
            "[CTF] Flag Auto Detonate": 33554432,
            "Force Gameover On Spec": 67108864,
            "Restricted Spectator Chat": 134217728,
            "[COOP] KeyCards Are Shared": 268435456,
            "[SURV/TLMS] Lives Are Shared": 536870912,
            "[SURV] Persistent Lives": 1073741824
        },
        netflagsB: {
            "[TEAMS] Colored Tripbombs": 1,
            "[CTF] No Steroids If With Flag": 2,
            "[CTF] No Jetpack If With Flag": 4,
            "[TERM] No Infinite Jetpack": 8,
            "[TERM] No Shrinker Immunity": 16,
            "[TERM] No Freezer Weakness": 32
        },
        netflagsC: {
            "Arsenal Rebalance": 1,
            "Laser Invisible W/O Nightvision": 2,
            "Freezer Can't Hurt Owner": 4,
            "Destructable Cameras": 8,
            "[1.3D] Double Kick": 16,
            "[1.3D] No Expander": 32,
            "Fix Tripbombs On Slopes": 64,
            "[DOS] Classic Map Start Behaviors": 128,
            "[DOS] FFire Excludes Self": 256,
            "[DOS] Can Respawn Drowning": 512,
            "[DOS] Invalid Shrink States": 1024,
            "[DOS] Bad Shrinker Hit Detection": 2048,
            "[DOS] Bad Grow Explosion Owner": 4096,
            "[DOS] Weapon Switching Bugs": 8192,
            "[DOS] Dead Player Swapping Bugs": 16384,
            "[DOS] Useless Nightvision": 32768,
            "[DOS] Auto-aimed RPGs Bugs": 65536
        },
        weapflags: {
            "Pistol": 1,
            "Shotgun": 2,
            "Chaingun": 4,
            "RPG": 8,
            "Pipebomb": 16,
            "Shrinker": 32,
            "Devastator": 64,
            "Tripbomb": 128,
            "Freezer": 256,
            "Full Ammo": 512,
            "Expander": 1024
        },
        invflags: {
            "Key Cards": 1,
            "Medkit": 2,
            "Steroids": 4,
            "Holoduke": 8,
            "Jetpack": 16,
            "Nightvision": 32,
            "Scuba Gear": 64,
            "Boots": 128,
            "Armor": 256,
            "Atomic Health 1": 512,
            "Atomic Health 2": 1024
        }
    };

    // preset dictionary
    const presets = {
        classic: {
            dm:      { netflagsA: 1020       , netflagsB: 0 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            coop:    { netflagsA: 35593      , netflagsB: 0 , netflagsC: 0     , weapflags: 1  , invflags: 0 },
            tdm:     { netflagsA: 558076     , netflagsB: 0 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            ctf:     { netflagsA: 33788      , netflagsB: 0 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            onefctf: { netflagsA: 33788      , netflagsB: 0 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            adctf:   { netflagsA: 33788      , netflagsB: 0 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            surv:    { netflagsA: 268471049  , netflagsB: 0 , netflagsC: 0     , weapflags: 1  , invflags: 0 },
            lms:     { netflagsA: 394236     , netflagsB: 0 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            tlms:    { netflagsA: 201884668  , netflagsB: 0 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            term:    { netflagsA: 33788      , netflagsB: 0 , netflagsC: 0     , weapflags: 1  , invflags: 1 }
        },
        alternative: {
            dm:      { netflagsA: 993        , netflagsB: 1 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            coop:    { netflagsA: 538968860  , netflagsB: 1 , netflagsC: 0     , weapflags: 1  , invflags: 0 },
            tdm:     { netflagsA: 2098145    , netflagsB: 1 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            ctf:     { netflagsA: 18875361   , netflagsB: 1 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            onefctf: { netflagsA: 18875361   , netflagsB: 1 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            adctf:   { netflagsA: 18875361   , netflagsB: 1 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            surv:    { netflagsA: 1881146140 , netflagsB: 1 , netflagsC: 0     , weapflags: 1  , invflags: 0 },
            lms:     { netflagsA: 993        , netflagsB: 1 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            tlms:    { netflagsA: 2098145    , netflagsB: 1 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            term:    { netflagsA: 2098145    , netflagsB: 17, netflagsC: 0     , weapflags: 1  , invflags: 1 }
        },
        modern: {
            dm:      { netflagsA: 1139708    , netflagsB: 1 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            coop:    { netflagsA: 6292233    , netflagsB: 1 , netflagsC: 0     , weapflags: 1  , invflags: 0 },
            tdm:     { netflagsA: 7955452    , netflagsB: 1 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            ctf:     { netflagsA: 15819772   , netflagsB: 1 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            onefctf: { netflagsA: 15819772   , netflagsB: 1 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            adctf:   { netflagsA: 15819772   , netflagsB: 1 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            surv:    { netflagsA: 274727689  , netflagsB: 1 , netflagsC: 0     , weapflags: 1  , invflags: 0 },
            lms:     { netflagsA: 1532924    , netflagsB: 1 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            tlms:    { netflagsA: 209282044  , netflagsB: 1 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            term:    { netflagsA: 7431164    , netflagsB: 9 , netflagsC: 0     , weapflags: 1  , invflags: 1 }
        },
        hardcore: {
            dm:      { netflagsA: 67142652   , netflagsB: 0 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            coop:    { netflagsA: 536909312  , netflagsB: 0 , netflagsC: 0     , weapflags: 1  , invflags: 0 },
            tdm:     { netflagsA: 67672060   , netflagsB: 0 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            ctf:     { netflagsA: 117479420  , netflagsB: 0 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            onefctf: { netflagsA: 117479420  , netflagsB: 0 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            adctf:   { netflagsA: 117479420  , netflagsB: 0 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            surv:    { netflagsA: 1879086592 , netflagsB: 0 , netflagsC: 0     , weapflags: 1  , invflags: 0 },
            lms:     { netflagsA: 67535868   , netflagsB: 0 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            tlms:    { netflagsA: 738760700  , netflagsB: 0 , netflagsC: 0     , weapflags: 1  , invflags: 1 },
            term:    { netflagsA: 67147772   , netflagsB: 24, netflagsC: 0     , weapflags: 257, invflags: 1 }
        },
        doslike: {
            dm:      { netflagsA: 33788      , netflagsB: 0 , netflagsC: 130944, weapflags: 1  , invflags: 1 },
            coop:    { netflagsA: 35593      , netflagsB: 0 , netflagsC: 130944, weapflags: 1  , invflags: 0 },
            tdm:     { netflagsA: 558076     , netflagsB: 0 , netflagsC: 130944, weapflags: 1  , invflags: 1 },
            ctf:     { netflagsA: 33788      , netflagsB: 0 , netflagsC: 130944, weapflags: 1  , invflags: 1 },
            onefctf: { netflagsA: 33788      , netflagsB: 0 , netflagsC: 130944, weapflags: 1  , invflags: 1 },
            adctf:   { netflagsA: 33788      , netflagsB: 0 , netflagsC: 130944, weapflags: 1  , invflags: 1 },
            surv:    { netflagsA: 268471049  , netflagsB: 0 , netflagsC: 130944, weapflags: 1  , invflags: 0 },
            lms:     { netflagsA: 427004     , netflagsB: 0 , netflagsC: 130944, weapflags: 1  , invflags: 1 },
            tlms:    { netflagsA: 201884668  , netflagsB: 0 , netflagsC: 130944, weapflags: 1  , invflags: 1 },
            term:    { netflagsA: 33788      , netflagsB: 0 , netflagsC: 130944, weapflags: 1  , invflags: 1 }
        }
    };

    // netflags presets input
    produke.parameters.presets = {
        modeSupport: ["multiplayer", "singleplayer"],
        type: "choice",
        label: "Preset",
        optional: false,
        syncOnly: true,
        choices: [
            {label: "Classic", value: "classic"},
            {label: "Alternative", value: "alternative"},
            {label: "Modern", value: "modern"},
            {label: "Hardcore", value: "hardcore"},
            {label: "DOS-Like", value: "doslike"},
            {label: "---", value: "---"}
        ],
        dependsOn: {
            params: "presets", 
            show: async c => {
                if (c?.ParamEl?.presets) {
                    const element = document.getElementById("game-param-presets");
                    if (!element.dataset.listening) {
                        element.dataset.listening = true;
                        element.addEventListener("input", e => {
                            const selectedGameMode = c.ParamEl.multiplayerMode;
                            const selectedPreset = e.target.value.replace(/\"/g, "");
                            applyPreset(selectedPreset, selectedGameMode);
                        });
                    }                    
                }
                return true;
            }
        }
    };

    // netflags inputs
    for (const netflag in netflags) {

        for (const flag in netflags[netflag]) {

            // slugify / sanitize / normalize
            const prop = `${netflag}${flag.replace(/[\[\]\/'.\-\s]/g, "")}`;

            // input
            produke.parameters[prop] = {
                "modeSupport": ["multiplayer", "singleplayer"],
                "type": "boolean",
                "syncOnly": true,
                "label": flag,
                "value": netflags[netflag][flag]          
            };

        }

        // argument
        produke.parameters[netflag] = {
            modeSupport: ["singleplayer", "multiplayer"],
            type: "static",
            label: netflag.charAt(0).toUpperCase() + netflag.slice(1).replace("flag", "Flag"),
            value: c => {
                let value = 0;
                for (let p in c.GameRoom.Params) {
                    if (p.startsWith(netflag)) {
                        value |= parseInt(c.GameRoom.ParamDefs[p]?.value || 0);
                    }
                }
                return value > 0 ? [`/${netflag}${value}`] : null;
            }
        };

    }

    // set flags in the UI based on preset and selected gamemode
    const applyPreset = (preset, mode) => {

        const flags = presets[preset][Object.keys(presets[preset])[mode-1]];

        for (const netflag in netflags) {
            for (const flag in netflags[netflag]) {
                const checked = (netflags[netflag][flag] & flags[netflag]) !== 0;
                const prop = `${netflag}${flag.replace(/[\[\]\/'.\-\s]/g, "")}`;
                document.getElementById(`game-param-${prop}`).checked = checked;
            } 
        }

    };

    // manipulate the html
    produke.parameters.html = {

        modeSupport: ["multiplayer", "singleplayer"],
        type: "boolean",
        label: "",
        optional: false,
        syncOnly: true,
        for: "private",

        dependsOn: {

            params: "html",

            show: () => {

                // converts a checkbox input to a switch style
                const CheckBoxToSwitch = (id, title) => {
                    const input = document.getElementById(id);
                    if (!input) return;
                    if (input.dataset.converted) return;
                    input.dataset.converted = true;
                    input.parentNode.classList.add("form-check", "form-switch");
                    input.parentNode.title = title;
                    input.classList.add("form-check-input");
                    input.insertAdjacentElement("afterend", input.parentNode.parentNode.nextElementSibling);
                };

                // transform some checkboxes into switches
                CheckBoxToSwitch("game-param-masterSlave", "-master and /i0");
                CheckBoxToSwitch("game-param-uploadDemos", "Upload demos to produke.com.br");
                CheckBoxToSwitch("game-param-lockOptions", "Prevent players from changing match settings and netflags");
                CheckBoxToSwitch("game-param-lockPlayers", "Prevent players from changing their color, team and nicknames");
                CheckBoxToSwitch("game-param-lockSpecs", "Prevent players from becoming spectator and vice versa in current match");
                CheckBoxToSwitch("game-param-botsAi", "Enable BOT AI");
                CheckBoxToSwitch("game-param-recordDmo", "Record match");
                CheckBoxToSwitch("game-param-spec", "Join as spectator");
                CheckBoxToSwitch("game-param-exploitMode", "Ask for tiles and visibility (requires voting)");
                CheckBoxToSwitch("game-param-allowMods", "Ask for all external files (requires voting)");
                CheckBoxToSwitch("game-param-disableAutoaim", "Ask for disabled autoaim (requires voting)");
                CheckBoxToSwitch("game-param-_nn_ipv6", "Use Direct IPv6 address between peers instead of Relay/STUN tunnels");               

                // =================================================================================
                // VARIABLES
                // =================================================================================

                const root = document.getElementById("mode")?.parentNode?.nextSibling?.querySelector("div");
                const isReady = document.querySelectorAll(`[id^="game-param"]`).length > 0; 

                // =================================================================================
                // EARLY RETURNS
                // =================================================================================

                // dont run if root is not present (this will also never run for clients since #mode iis not defined)
                if (!root) return;
               
                // dont run if game params are not present yet
                if (!isReady) return;

                // =================================================================================
                // INJECT CSS
                // =================================================================================

                // check if css is already injected
                if (!window.produkeCSSInjected) {

                    // flag as injected
                    window.produkeCSSInjected = true;

                    // inject css
                    document.body.insertAdjacentHTML("afterbegin", `

                        <style>

                            /* hide room fake box in single player screen and other ports screens */
                            div.modal-body:has(select#mode > option[value="singleplayer"]:checked),
                            div.modal-body:not(:has(img[src*="produke"])) {
                                div#room-settings-label,
                                div#room-settings-header,
                                div#room-settings-footer {
                                    display: none !important;
                                }
                            }

                            /* prevent style from applying to other ports */
                            div.modal-body:has(img[src*="produke"]) {
                            
                                /* ================================================================================= */
                                /* GRID HACK                                                                         */
                                /* ================================================================================= */

                                /* outter div */
                                div:has(>#mode) + div {
                                    display: grid;
                                    grid-template-columns: repeat(4, 1fr);
                                    /*gap: 8px;*/
                                    grid-auto-rows: auto;
                                }

                                /* fake box background on all inputs */
                                div:has(>#mode) + div > :not(div.title-label):not(div.header):not(div.footer):not(div:first-child):not(div:has(>#manual-param-controls)) {
                                    background-color: #17191c;
                                    border: 1px solid #495057;
                                    border-top: none;
                                    border-bottom: none;
                                    padding: 4px 16px;
                                }

                                /* force all children to use 1 full row */
                                div:has(>#mode) + div > * { 
                                    grid-column: 1 / -1;
                                }

                                /* inner div */
                                div:has(>#mode) + div>div:first-child {
                                    display: grid;
                                    grid-template-columns: repeat(4, 1fr);
                                    /*gap: 8px;*/
                                    grid-row: 7;
                                    grid-auto-rows: auto;
                                }

                                /* fake box background on all inputs */
                                div:has(>#mode) + div>div:first-child > :not(div.title-label):not(div.header):not(div.footer):not(div:has(>div>div.form-switch)) {
                                    background-color: #17191c;
                                    border: 1px solid #495057;
                                    border-top: none;
                                    border-bottom: none;                                    
                                    box-sizing: content-box;
                                    padding: 4px 16px;
                                }

                                /* alternative fake box background for switches */
                                div:has(>#mode) + div>div:first-child > div:has(>div>div.form-switch) {
                                    background-color: #17191c;
                                    height: 28px !important;
                                }

                                /* force all children to use 1 full row */
                                div:has(>#mode) + div>div:first-child > * { 
                                    grid-column: 1 / -1;
                                }

                                /* make param hidden actually hidden */
                                .param-hidden, .param-hidden * {
                                    display: none !important;
                                }

                                /* hide hack element */
                                div:has(>div>#game-param-html) {
                                    display: none;
                                }

                                /* title label separator */
                                div.title-label {
                                    font-family: "Candara";
                                    font-weight: bold;
                                    padding: 8px 0px;
                                    margin: 16px;
                                    border-bottom: 1px solid #495057;
                                    z-index: 99;
                                }

                                /* header */
                                div.header {
                                    background-color: #17191c;
                                    border: 1px solid #495057;
                                    border-top-right-radius: 10px;
                                    border-top-left-radius: 10px;
                                    border-bottom: none;
                                    margin-top: 16px;
                                    padding-bottom: 8px;
                                }

                                /* footer */
                                div.footer {
                                    background-color: #17191c;
                                    border: 1px solid #495057;
                                    border-top: none;
                                    border-bottom-right-radius: 10px;
                                    border-bottom-left-radius: 10px;
                                    height: 16px;
                                }

                                /* flags header */
                                div.flag-header {
                                    background-color: #17191c;
                                    border-radius: 0px;
                                    border: none;
                                    padding: 0px !important;
                                    margin: 0px !important;
                                }

                                /* flags label */
                                div.flag {
                                    background-color: transparent;
                                    border-radius: 0px;
                                    border: none;
                                    border-bottom: 1px solid #495057;
                                    text-align: left;
                                    padding-left: 0px;
                                }

                                /* ================================================================================= */
                                /* ROOM SETTINGS                                                                     */
                                /* ================================================================================= */

                                div#room-settings-label { grid-row: 1; }
                                div#room-settings-header { grid-row: 1; }
                                div:has(>input#room-name) { grid-row: 2;  }
                                div:has(>input#password) { grid-row: 3; }
                                div:has(>input#max-players) { grid-row: 4; }
                                /*div:has(>div.form-switch > label[title=""]) { grid-row: 5 !important; grid-column: 1 / span 4 !important; padding-left: 185px !important; }*/

                                /* hide room */
                                div:not(.room-field):not(.parameter-row):has(>div.form-switch input:not([id^="game-param"])) { 
                                    grid-row: 5 !important; 
                                    grid-column: 1 / span 4 !important;
                                    padding-left: 190px !important;
                                }
                                
                                /* ipv6 only */
                                div.room-field:has(>div.form-switch) { 
                                    /*
                                    grid-row: 6 !important; 
                                    grid-column: 1 / span 4 !important;
                                    padding-left: 190px !important;
                                    */
                                    /* just hide this, might cause confusion */
                                    display: none !important;
                                }

                                /* host catalog */
                                section.host-catalogue {
                                    /* ideia is nice, but lets just hide this */
                                    display: none !important;
                                }

                                div.parameter-row:has(#game-param-_nn_ipv6)    { grid-row: 1; grid-column: 1 / span 2 !important; padding-left: 190px; border-left: 1px solid #495057; }
                                /*div.parameter-row:has(#game-param-uploadDemos) { grid-area: 1 / 3 !important; }*/
                                div.parameter-row:has(#game-param-masterSlave) { grid-row: 1; grid-column: 3 / span 2 !important; padding-right: 111px; border-right: 1px solid #495057; }
                                div.parameter-row:has(#game-param-lockOptions) { grid-row: 2; grid-column: 1 / span 2 !important; padding-left: 190px; border-left: 1px solid #495057; }
                                div.parameter-row:has(#game-param-lockPlayers) { grid-area: 2 / 3 !important; }
                                div.parameter-row:has(#game-param-lockSpecs)   { grid-area: 2 / 4 !important; border-right: 1px solid #495057; padding-right: 16px; }
                                div#room-settings-footer { grid-row: 3; }

                                /* ================================================================================= */
                                /* MATCH SETTINGS                                                                    */
                                /* ================================================================================= */

                                div#match-settings-label                           { grid-row: 4; }
                                div#match-settings-header                          { grid-row: 4; }
                                div.parameter-row:has(#game-param-multiplayerMode) { grid-row: 5; }
                                div.parameter-row:has(#game-param-monstersSkill)   { grid-row: 6; }
                                div.parameter-row:has(#game-param-mapType)         { grid-row: 7; }
                                div.parameter-row:has(#game-param-episodeAndLevel) { grid-row: 8; }
                                div.parameter-row:has(#game-param-map)             { grid-row: 9; }
                                div.parameter-row:has(#game-param-scoreLimit)      { grid-row: 10; }
                                div.parameter-row:has(#game-param-timeLimit)       { grid-row: 11; }
                                div.parameter-row:has(#game-param-extraLives)      { grid-row: 12; }
                                div.parameter-row:has(#game-param-botsNum)         { grid-row: 13; }
                                div.parameter-row:has(#game-param-botsAi)          { grid-row: 14 !important; grid-column: 1 / span 4 !important; padding-left: 190px !important; border-left: 1px solid #495057; border-right: 1px solid #495057; }
                                div#match-settings-footer                          { grid-row: 15; }

                                /* ================================================================================= */
                                /* USERS SETTINGS                                                                    */
                                /* ================================================================================= */

                                div#user-settings-label                           { grid-row: 16; }
                                div#user-settings-header                          { grid-row: 16; }
                                div.parameter-row:has(#game-param-playDmo)        { grid-row: 17; }
                                div.parameter-row:has(#game-param-color)          { grid-row: 18; }
                                div.parameter-row:has(#game-param-team)           { grid-row: 19; }
                                div.parameter-row:has(#game-param-recordDmo)      { grid-row: 20; grid-column: 1 / span 2 !important; padding-left: 190px; border-left: 1px solid #495057; }
                                div.parameter-row:has(#game-param-spec)           { grid-row: 20; grid-column: 3 / span 2 !important; padding-right: 111px; border-right: 1px solid #495057; }
                                div.parameter-row:has(#game-param-exploitMode)    { grid-row: 21; grid-column: 1 / span 2 !important; padding-left: 190px; border-left: 1px solid #495057; }
                                div.parameter-row:has(#game-param-allowMods)      { grid-area: 21 / 3 !important; }
                                div.parameter-row:has(#game-param-disableAutoaim) { grid-area: 21 / 4 !important; border-right: 1px solid #495057; padding-right: 16px; }
                                div#user-settings-footer                          { grid-row: 22; }

                                /* ================================================================================= */
                                /* NETFLAGS                                                                          */
                                /* ================================================================================= */

                                div#netflags-label { grid-row: 23; }
                                div#netflags-header { grid-row: 23; }
                                div:has(>div>select#game-param-presets) { grid-row: 24; }

                                /* netflags A */
                                div#netflagsA { grid-row: 25; grid-column: 1 / span 2 !important; }
                                div#netflagsA-header { grid-row: 25; grid-column: 1 / span 2 !important; border-left: 1px solid #495057; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsAWeaponsPickableOnce)       { grid-row: 26 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsARespawnMonsters)           { grid-row: 27 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsARespawnItems)              { grid-row: 28 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsARespawnInventory)          { grid-row: 29 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsAMarkers)                   { grid-row: 30 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsADontSpawnMonsters)         { grid-row: 31 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsADontSpawnKeycards)         { grid-row: 32 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsASpawnDMOnlySwitches)       { grid-row: 33 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsASpawnMPOnlyItems)          { grid-row: 34 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsACOOPTEAMSFriendlyFire)     { grid-row: 35 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsACOOPTEAMSAutoaimOnAllies)  { grid-row: 36 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsACOOPTEAMSGlobalAllySounds) { grid-row: 37 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsACOOPTEAMSNoSpycamMapview)  { grid-row: 38 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsARevealedAutomap)           { grid-row: 39 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsANoMapExit)                 { grid-row: 40 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsANoTargetNames)             { grid-row: 41 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsAWeaponAlwaysDropsOnKill)   { grid-row: 42 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsAForceRespawn)              { grid-row: 43 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsAPVPRespawnFarthest)        { grid-row: 44 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsATEAMSMixedTeamSpawnPoints) { grid-row: 45 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsADamageNumbers)             { grid-row: 46 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsACOOPTEAMSTERMOverheadInfo) { grid-row: 47 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsACOOPTEAMSTERMOutlines)     { grid-row: 48 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsACTFOutlineOnFlags)         { grid-row: 49 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsACTFFlagReturnInstantly)    { grid-row: 50 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsACTFFlagAutoDetonate)       { grid-row: 51 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-netflagsAForceGameoverOnSpec)       { grid-row: 52 !important; grid-column: 1 / span 4 !important; }
                                div:has(>div>div>input#game-param-netflagsARestrictedSpectatorChat)   { grid-row: 53 !important; grid-column: 1 / span 4 !important; }
                                div:has(>div>div>input#game-param-netflagsACOOPKeyCardsAreShared)     { grid-row: 54 !important; grid-column: 1 / span 4 !important; }
                                div:has(>div>div>input#game-param-netflagsASURVTLMSLivesAreShared)    { grid-row: 55 !important; grid-column: 1 / span 4 !important; }
                                div:has(>div>div>input#game-param-netflagsASURVPersistentLives)       { grid-row: 56 !important; grid-column: 1 / span 4 !important; }
                                
                                /* netflags B */
                                div#netflagsB { grid-row: 25; grid-column: 3 / span 2 !important; }
                                div#netflagsB-header { grid-row: 25; grid-column: 3 / span 2 !important; border-right: 1px solid #495057; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsBTEAMSColoredTripbombs)   { grid-row: 26 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsBCTFNoSteroidsIfWithFlag) { grid-row: 27 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsBCTFNoJetpackIfWithFlag)  { grid-row: 28 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsBTERMNoInfiniteJetpack)   { grid-row: 29 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsBTERMNoShrinkerImmunity)  { grid-row: 30 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsBTERMNoFreezerWeakness)   { grid-row: 31 !important; grid-column: 3 / span 2 !important; border-left: none !important; }

                                /* netflags C */
                                div#netflagsC { grid-row: 32 / span 3; grid-column: 3 / span 2 !important; height: 41.91px; }
                                div#netflagsC-header { grid-row: 32 / span 3; grid-column: 3 / span 2 !important; border-right: 1px solid #495057; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsCArsenalRebalance)            { grid-row: 35 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsCLaserInvisibleWONightvision) { grid-row: 36 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsCFreezerCantHurtOwner)        { grid-row: 37 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsCDestructableCameras)         { grid-row: 38 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsC13DDoubleKick)               { grid-row: 39 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsC13DNoExpander)               { grid-row: 40 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsCFixTripbombsOnSlopes)        { grid-row: 41 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsCDOSClassicMapStartBehaviors) { grid-row: 42 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsCDOSFFireExcludesSelf)        { grid-row: 43 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsCDOSCanRespawnDrowning)       { grid-row: 44 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsCDOSInvalidShrinkStates)      { grid-row: 45 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsCDOSBadShrinkerHitDetection)  { grid-row: 46 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsCDOSBadGrowExplosionOwner)    { grid-row: 47 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsCDOSWeaponSwitchingBugs)      { grid-row: 48 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsCDOSDeadPlayerSwappingBugs)   { grid-row: 49 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsCDOSUselessNightvision)       { grid-row: 50 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-netflagsCDOSAutoaimedRPGsBugs)        { grid-row: 51 !important; grid-column: 3 / span 2 !important; border-left: none !important; }

                                /* weapflags */
                                div#weapflags { grid-row: 57; grid-column: 1 / span 2 !important; }
                                div#weapflags-header { grid-row: 57; grid-column: 1 / span 2 !important; border-left: 1px solid #495057; border-right: none !important; }
                                div:has(>div>div>input#game-param-weapflagsPistol)     { grid-row: 58 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-weapflagsShotgun)    { grid-row: 59 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-weapflagsChaingun)   { grid-row: 60 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-weapflagsRPG)        { grid-row: 61 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-weapflagsPipebomb)   { grid-row: 62 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-weapflagsShrinker)   { grid-row: 63 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-weapflagsDevastator) { grid-row: 64 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-weapflagsTripbomb)   { grid-row: 65 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-weapflagsFreezer)    { grid-row: 66 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-weapflagsFullAmmo)   { grid-row: 67 !important; grid-column: 1 / span 2 !important; border-right: none !important; }
                                div:has(>div>div>input#game-param-weapflagsExpander)   { grid-row: 68 !important; grid-column: 1 / span 2 !important; border-right: none !important; }

                                /* invflags */
                                div#invflags { grid-row: 57; grid-column: 3 / span 2 !important; }
                                div#invflags-header { grid-row: 57; grid-column: 3 / span 2 !important; border-right: 1px solid #495057; border-left: none !important; }
                                div:has(>div>div>input#game-param-invflagsKeyCards)      { grid-row: 58 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-invflagsMedkit)        { grid-row: 59 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-invflagsSteroids)      { grid-row: 60 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-invflagsHoloduke)      { grid-row: 61 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-invflagsJetpack)       { grid-row: 62 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-invflagsNightvision)   { grid-row: 63 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-invflagsScubaGear)     { grid-row: 64 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-invflagsBoots)         { grid-row: 65 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-invflagsArmor)         { grid-row: 66 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-invflagsAtomicHealth1) { grid-row: 67 !important; grid-column: 3 / span 2 !important; border-left: none !important; }
                                div:has(>div>div>input#game-param-invflagsAtomicHealth2) { grid-row: 68 !important; grid-column: 3 / span 2 !important; border-left: none !important; }

                                div#netflags-footer { grid-row: 69; }

                                div:has(>#manual-param-controls) { grid-row: 8; }

                                div.parameter-row:has(input[id^="game-param-netflags"]),
                                div.parameter-row:has(input[id^="game-param-weapflags"]),
                                div.parameter-row:has(input[id^="game-param-invflags"]) {
                                    padding-top: 0px !important;
                                    padding-bottom: 0px !important;
                                }

                                /* ================================================================================= */
                                /* INPUTS                                                                            */
                                /* ================================================================================= */

                                div.room-field {
                                    margin: 0px !important;
                                    display: flex;
                                    flex-direction: row;
                                    align-items: center;
                                }

                                div:has(>div>select[id^="game-param"]):not(.param-hidden),
                                div:has(>div>span>input[id^="game-param"]):not(.param-hidden) {
                                    height: 38px !important;
                                    min-height: 38px !important;
                                }

                                div:has(>input) > label,
                                div:has(>div>div>input[id^="game-param"]) > div:not(:has(div>input)),
                                div:has(>div>select[id^="game-param"]) > div:not(:has(select)),
                                div:has(>div>span>input[id^="game-param"]) > div:not(:has(span>input)) {
                                    display: flex;
                                    flex-grow: 1;
                                    user-select: none; 
                                    text-wrap: nowrap;
                                }
                                
                                div:has(>div>div>input[id^="game-param"]) > div:has(div>input:not([type="checkbox"])),
                                div:has(>div>select[id^="game-param"]) > div:has(select),            
                                div:has(>div>span>input[id^="game-param"]) > div:has(span>input) {
                                    width: 470px !important;
                                }

                                input[type="text"],
                                input[type="plain"],
                                input[type="password"],
                                select[id^="game-param"] {
                                    width: 470px;
                                }

                                input[type="number"] {
                                    width: 60px;
                                    margin-right: 16px;
                                }

                                input[type="range"] {
                                    width: 376px;
                                }

                                .parameter-row {
                                    border-bottom: none !important;
                                }

                            }

                        </style>

                    `);

                }

                // =================================================================================
                // INJECT SOME LABELS
                // =================================================================================

                // inject room settings label
                if (!document.getElementById("room-settings-label")) {
                    root.insertAdjacentHTML("afterend", `
                        <div id="room-settings-label" class="title-label">ROOM SETTINGS</div>
                    `);
                }

                // inject room settings header
                if (!document.getElementById("room-settings-header")) {
                    root.insertAdjacentHTML("afterend", `
                        <div id="room-settings-header" class="header"></div>
                    `);
                }

                // inject room settings footer
                if (!document.getElementById("room-settings-footer")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="room-settings-footer" class="footer"></div>
                    `);
                }

                // inject match settings label
                if (!document.getElementById("match-settings-label")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="match-settings-label" class="title-label">MATCH SETTINGS</div>
                    `);
                }

                // inject match settings header
                if (!document.getElementById("match-settings-header")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="match-settings-header" class="header"></div>
                    `);
                }

                // inject match settings footer
                if (!document.getElementById("match-settings-footer")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="match-settings-footer" class="footer"></div>
                    `);
                }

                // inject user settings label
                if (!document.getElementById("user-settings-label")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="user-settings-label" class="title-label">USER SETTINGS</div>
                    `);
                }

                // inject user settings header
                if (!document.getElementById("user-settings-header")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="user-settings-header" class="header"></div>
                    `);
                }

                // inject user settings footer
                if (!document.getElementById("user-settings-footer")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="user-settings-footer" class="footer"></div>
                    `);
                }

                // inject netflags label
                if (!document.getElementById("netflags-label")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="netflags-label" class="title-label">NETFLAGS</div>
                    `);
                }

                // inject netflags header
                if (!document.getElementById("netflags-header")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="netflags-header" class="header"></div>
                    `);
                }

                // inject netflags footer
                if (!document.getElementById("netflags-footer")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="netflags-footer" class="footer"></div>
                    `);
                }

                // inject netflags A label
                if (!document.getElementById("netflagsA")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="netflagsA" class="title-label flag">NETFLAGS A</div>
                    `);
                }

                // inject netflags A header
                if (!document.getElementById("netflagsA-header")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="netflagsA-header" class="flag-header"></div>
                    `);
                }

                // inject netflags B label
                if (!document.getElementById("netflagsB")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="netflagsB" class="title-label flag">NETFLAGS B</div>
                    `);
                }

                // inject netflags B header
                if (!document.getElementById("netflagsB-header")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="netflagsB-header" class="flag-header"></div>
                    `);
                }

                // inject netflagsC label
                if (!document.getElementById("netflagsC")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="netflagsC" class="title-label flag">NETFLAGS C</div>
                    `);
                }

                // inject netflags C header
                if (!document.getElementById("netflagsC-header")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="netflagsC-header" class="flag-header"></div>
                    `);
                }

                // inject weapflags label
                if (!document.getElementById("weapflags")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="weapflags" class="title-label flag">STARTING WEAPONS</div>
                    `);
                }

                // inject weapflags header
                if (!document.getElementById("weapflags-header")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="weapflags-header" class="flag-header"></div>
                    `);
                }

                // inject invflags label
                if (!document.getElementById("invflags")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="invflags" class="title-label flag">STARTING INVENTORY</div>
                    `);
                }

                // inject invflags header
                if (!document.getElementById("invflags-header")) {
                    root.insertAdjacentHTML("beforeend", `
                        <div id="invflags-header" class="flag-header"></div>
                    `);
                }

                // return nothing so the component doesn't show
                return;
                
            }

        }

    };

    // set gamedef
    gamedefs.games.duke3d.executables.produke = produke; // return produke;

}