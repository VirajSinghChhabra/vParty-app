# vParty Extension

### Video Demo: <URL HERE>

### Description

vParty is a Chrome extension that enables synchronized Netflix viewing with friends in a "Watch Party Room". The project combines peer-to-peer video synchronization with real-time chat functionality, wrapped in a user-friendly interface which is integrated with a website providing information on the extension's features while also handling user onboarding and profile settings.

## Core Features

- Synchronized video playback across multiple viewers
- Real-time chat system
- User authentication and profile management
- Easy party creation and joining via invite links
- Automatic reconnection and state management
- Persistent session handling

## Technical Architecture

### Technologies Used

- Vanilla JavaScript for popup functionality, content and background scripts, and DOM manipulation
- Website Frontend: HTML5, CSS3, Bootstrap 5.1
- Backend: Node.js with Express.js framework
- Database: SQLite3 for lightweight, serverless data storage
- Authentication: JWT (jsonwebtoken) for stateless authentication, bcrypt for password hashing
- Real-time Communication: WebRTC with PeerJS library for peer-to-peer connections
- Browser Integration: Chrome Extension APIs (tabs, storage, runtime messaging)
- Email Service: Nodemailer for password reset functionality
- Development Tools: VSCode, Chrome DevTools for debugging
- Version Control: Git for code management

#### Extension Core Components

- #### Video Synchronization and Party Management

  1. #### content.js: The heart of the extension, managing

        - Netflix player integration through injected scripts using message passing
        - Party state management using Chrome Storage API for persistence
        - Token handling between website and extension via communication with background.js
        - Complex messaging system using chrome.runtime.sendMessage and onMessage listeners for party functionalities
        - Video detection using DOM manipulation
        - Invite link generation
        - Integration with Room and VideoSynchronizer classes for synchronized playback
        - Error handling and automatic recovery mechanisms
        - Event delegation for efficient DOM event handling

  2. #### injected.js: Handles Netflix player control

        - Direct interaction with Netflix's player API
        - Video playback control (play, pause, seek)
        - Time synchronization in short intervals by calling getCurrentTime()
        - Event handling for player state changes
        - Error handling for player interactions

  3. #### Room.js: Manages WebRTC connections and party coordination using PeerJS

        - Peer-to-peer connection establishment
        - Host/client role assignment using unique PeerJS IDs
        - Custom event system implementation for party communications
        - Connection state monitoring with heartbeat mechanism
        - Command broadcasting using WebRTC data channels
        - Error recovery with exponential backoff retry strategy
        - Connection state handling
        - Error recovery and disconnect handling

  4. #### VideoSynchronizer.js: Handles precise playback synchronization

        - Time difference calculations and adjustments
        - Buffer management
        - Periodic sync checks
        - Host state broadcasting
        - Client state adjustment
        - Edge case handling for network delays
        - Cleanup of event listeners on disconnection

- #### Extension Interface and State Management

  1. #### background.js: Manages extension-wide state

        - Token storage and retrieval through communication with website and using Chrome Storage API
        - Cross-component message routing
        - User session management
        - Tab state monitoring (to inject token for displaying user information in popup)

  2. #### popup.js: Controls extension user interface

        - UI state updates
        - Party controls (start/join/disconnect)
        - Authentication state display
        - Invite link management
        - User profile settings integration with website
        - Displays redirect button initially if user not on Netflix

  3. #### manifest.json: Defines extension structure

        - Permission requirements
        - Content script injection rules
        - Resource accessibility
        - Extension capabilities and limitations
        - Security policies

- #### Supporting Classes

  1. #### ChatManager.js: Implements chat functionality

        - Real-time message handling
        - Chat UI management
        - Message persistence
        - User identification
        - Chat overlay toggle controls
        - Chat container cleanup on disconnection

  2. #### ConnectionManager.js: Handles connection stability

        - Connection monitoring
        - Automatic reconnection
        - Error recovery
        - State restoration

  3. #### WatchPartyState.js: Manages party state persistence

        - State storage in Chrome storage
        - Party information management
        - State restoration on reconnection
        - Clears state on disconnection

#### Web Application Components

- #### Backend

    1. server.js: Main application server:

        - Route handling
        - Authentication endpoints
        - User management
        - Profile operations
        - Password reset functionality
        - Security middleware

    2. auth.js: Authentication system:

        - Token generation and validation
        - Password hashing
        - Session management
        - Security middleware

    3. database.js: Database operations:

        - User data storage
        - Session tracking
        - Schema definitions
        - Query handling

- #### Frontend

    1. main.js: Website functionality:
        - Form handling
        - API interactions
        - Token management
        - UI updates

    2. settings.html/index.html: User interfaces:

        - Authentication forms
        - Profile management
        - Password reset
        - Navigation

- #### Styling

    1. chat.css: Chat interface styling
    1. popup.css: Extension popup styling
    1. styles.css: Website styling

- #### Libraries/Framework files

    1. bootstrap.bundle.min.js
    2. bootstrap.min.css
    3. peerjs.min.js

## Implementation Details

### Authentication Flow

1. User accesses extension popup
2. If not authenticated, login/signup button click redirects to website
3. After successful registration/login:

    - Server generates JWT token
    - Token stored in Chrome storage
    - Extension components updated with auth state
    - Popup UI refreshed to show logged-in state

### Starting a Watch Party Flow

1. If user isn't on Netflix's site, popup displays a redirect "Open Netflix" button

2. User simply selects a video, "Start Watch Party" button appears in popup

3. User clicks it and voila, party started!

4. An invite link appears in the popup ready to be shared

5. Another peer pastes the link in their browser and automatically joins the Watch Party/Room

6. Both peers see a chat box beside the video for real time communication

### Video Synchronization Implementation

1. Host establishes WebRTC connection through Room:

    - PeerJS connection initialization with unique session IDs
    - WebRTC data channel setup for control messages
    - Connection state monitoring with heartbeat packets
    - Automatic role assignment based on party creation

2. VideoSynchronizer monitors player state:
    - Direct integration with Netflix player API
    - Event listeners for play, pause, and seek actions
    - Buffering state detection and handling
    - Time drift calculation and compensation
    - Frame-accurate synchronization attempts

3. Synchronization Protocol:
    - Regular timestamp exchange (every 5 seconds)
    - Time difference calculation with network latency compensation
    - Threshold-based resynchronization (>2 second drift)
    - Buffering state propagation to prevent desyncs
    - Seeking coordination with message queuing
    - Minimal difference of <2 seconds between synced videos

4. Error Handling and Recovery:
    - Connection loss detection and automatic reconnection
    - State restoration after reconnection
    - Buffer state synchronization
    - Playback rate adjustment for minor corrections
    - Fallback mechanisms for failed synchronization attempts

### Real-time Chat System

1. Overlay UI integrated with Netflix player
2. Messages transmitted through WebRTC data channels
3. User identification from authentication
4. Chat state preserved during session

## Design Decisions, Challenges faced and Changes Made

### WebRTC Over WebSockets (Major Revamp)

I had initially implemented everything using WebSockets, but after a long while, of multiple days, of failed attempts to get the video synchronisation properly working and being demoralized (that imposter syndrome of what am I even doing, why am I getting a 171 repeated errors haha) - I made the decision to remove and redo a good portion of my video synchronisation and related code. I transitioned the extension to WebRTC/PeerJS and it paid off because here we are. It works perfectly.

Why? Because it allows for:

- Direct peer-to-peer communication
- Better real-time performance
- Significantly easier to implement video synchronisation, in my experience
- Simplified party management

I found WebRTC easier to understand/learn (it was my first time implementing either) because I struggled a lot with how the communication (and it's timing, delays etc) between server and client should work, and I was unable to fix the repeated requests causing the extension to breakdown, and me as well. In hindsight, my video player handling was also an issue then, which after I fixed by implementing Netflix's API properly during the revamp, may have been the reason for the video synchronisation working as intended. To be fair, there is still a slight difference of <2 seconds between the synced videos but it's not of much concern.

### Class-based Architecture

I wasn't initially using a class based structure or the number of separated files I have now for the video synchronisation functions of the chrome extension. Everything was crammed into the content and background scripts. This would be a massive issue as so much of my time was wasted going through large files to find connected code for implementation of a feature on top of existing code, and especially the debugging. It was my first time working on a full stack project, and a chrome extension, which was to be of this massive size, using a professionaly designed (almost) structure and lots of code. Resetting things to work with WebRTC/PeerJS, I made sure to use proper classes/structure and consciously write much cleaner code with console logs for debuggig, along with slower progression at small steps, which made the implementation significantly easier.

In short, a class based structure helps to:

- Separate concerns
- Manage complexity
- Enable easier testing
- Facilitate future extensions

### State Management

My initial implementation would use the local storage for the token, but this didn't match with my website auth to popup flow. The token would be "stuck" stored in the local storage not available at all times to all tabs and popup for the user to stay logged into the popup. So it was necessary to store it in the chrome local storage and broadcast the token using Chrome Storage API from the content -> background scripts -> popup.

The State is managed across multiple contexts using:

- Chrome storage for persistence
- Background script for global state
- Content script for active state
- Classes for specific feature states

### Minimizing the webpages

Till about halfway into the project, I pretty much had separate html files/webpages for each user profile function like registeration, login and so on. This was an unintuitive design and flow for the user, but my plan initially was to simply get things working and fix this later. When I reached the point where it seemed like an unncessary problem to deal with while integrating the website functionality with the popup, it was an easy decision to integrate all the user profile management into a single file/webpage for easier functionality. The website now provides a concise onboarding process, the Homepage provides easy to use features of the extension with a simple user creation experience.
