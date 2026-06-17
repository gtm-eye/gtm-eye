# Project Description

## Overview

This project is a comprehensive Chrome extension designed to enhance the management and monitoring of Google Tag Manager (GTM) scripts. The extension offers robust functionalities to detect, block, and analyze tags inside GTM containers, providing users with enhanced control over the scripts that are executed in their browsers.

## Features

- **Detection and Blocking**: Automatically detect and block GTM scripts based on predefined or dynamic rules.
- **GTM Data Handling**: Extract and parse data from GTM scripts for detailed analysis.
- **Dynamic Script Injection**: Inject custom scripts dynamically to manage and manipulate GTM behavior.
- **Notifications**: Real-time notifications about the state and changes of GTM scripts.
- **Server Components**: Includes server components to handle requests with custom headers and serve obfuscated GTM scripts.
<!-- - **Injection Tree**: Visual representation of the hierarchy and structure of the tree of injected scripts. -->

## About

Authors and contributors:
- Marouane (https://github.com/Marouane133)
- Gilles (https://github.com/MeGilles)
- Vincent (https://github.com/vincent-grenoble)
- Youssef El Atia

This project has been created by [PRIVATICS](https://team.inria.fr/privatics/) Inria team members, in the context of the [IPoP](https://files.inria.fr/ipop) project.
Related research articles are available [here](https://github.com/gtm-eye/research_articles).


# Extension Installation Guide (Chrome/Chromium)

If you want to benefit from the packaged extension (otherwise see the developper's version below):

1. **Download the extension**
   
   - download the GTM-EyE.zip archive from this repository 
   - decompress the release.zip
   - the `GTM-EyE` folder will be created

2. **Disable Prefetch in Chrome Settings:**

   - Open Chrome and go to `chrome://settings/performance`.
   - Turn off the setting `Preload pages`.

3. **Load the Extension:**

    - Go to `chrome://extensions/`.
    - Activate Developer mode by toggling the switch in the top right corner.
    - Click on `Load unpacked`.
    - Select the `GTM-EyE` directory created in step 1.
    - To make the extension button more accessible, you can pin the extension your browser toolbar.


# Developper Installation Guide

If you prefer to compile the extension (instead of using the packaged extension):

## Building 

1. Install the dependencies:
    ```sh
    npm i
    ```

2. Build the project:
    ```sh
    npm run build
    ```

## Installation in the Browser
    
 - Follow the "Extension Installation guide" from step 2
 - At step 3 instead of selecting the `GTM-EyE` directory, select the `build` directory generated from the `npm run build` command.


# Hierarchy

### public/
Contains files used in the Chrome extension.
- **assets/** : Contains Maps used in the extension.
  - **officialTags.js** : List of all official tags.
  - **officialTagsMap.json** : Official tags's map.
  - **galleryMap.json** : Gallery tags's map.
  - **galleryPermsMap.json** : Gallery tags permissions's map.
- **gtm-lib/** : Library files for GTM data handling.
  - **gtmDataExtractor.js** : Extracts data from GTM scripts.
  - **gtmDataParser.js** : Parses GTM data.
  - **gtmInjectionTree.js** : Manages the GTM injection tree.
- **images/** : Image assets for the extension.
- **manifest.json** : Configuration file for the Chrome extension.
- **detection_rules.json** : Rules for detecting and blocking GTM scripts.
- **background.js** : Background script for the Chrome extension.
- **contentScript.js** : Content script for the Chrome extension.
- **index.html** : The Chrome extension popup.

### src/
React source code of the front end of the extension.

### scripts/
Custom scripts used in the project.
- **init.sh** : Script that generates the tags's maps.
- **init.js** : Script containing code for maps generation.

### proxy-server/
Server that sends requests needing custom headers and serve obfuscated GTM scripts.
- **server.js** : Script that runs the server.
- **domainObfuscation.js** : GTM script with obfuscated domain.
- **encoded.js** : Base64 encoded GTM script.
- **evalObfuscation.js** : Script injecting the `encoded.js` using `eval`.
- **doubleObfuscation.js** : Script that dynamically injects the `evalObfuscation.js` script.

### obfuscation-server/
Web app loading obfuscated GTM scripts.
- **run.sh** : Script that runs the server.
- **index.html** : HTML page for a web app loading obfuscated GTM scripts.


