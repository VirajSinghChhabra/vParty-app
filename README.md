# vParty Extension

#### Video Demo: <https://youtu.be/pGPzNyz4tPE?si=3cdC3xnM9hyQY13G>

*Please Note - Netflix won’t let me screen record the videos but you hear note the audio being synced on seek, play and pause events along with the subtitles. The video synchronisation works on your local device with two separate chrome accounts that are logged into the extensions separately as I have shown. I have also added a picture from my phone's camera of the video sync working (as I mentioned in the video, there is a 1 second difference between the two videos because of latency). Please feel free to test it staff/team. Thank you:)

I created this project in VS Code locally (setting up my dev environment for the first time) rather than the cs50 codespace, and I was suggested to paste the files directly into the cs50 repo and also to add my original Github repo link here.

Original Github repo link: <https://github.com/VirajSinghChhabra/vParty-app.git>

## Description

vParty is a Chrome extension that enables synchronized Netflix viewing with friends in a "Watch Party Room". The project combines peer-to-peer video synchronization with real-time chat functionality, wrapped in a user-friendly interface which is integrated with a website providing information on the extension's features while also handling user onboarding and profile settings.

##### *Note - This project is inspired by a Chrome Extension called Teleparty. This project has not been deployed, I have solely made it as an educational work for my Final Project for Harvard's CS50x.*

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
- Email Service: Nodemailer, Mailtrap for password reset functionality
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
        - Forgot Passsword and Password reset functionality
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

- #### Libraries/Frameworks

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

### Minimizing The Webpages

Till about halfway into the project, I pretty much had separate html files/webpages for each user profile function like registeration, login and so on. This was an unintuitive design and flow for the user, but my plan initially was to simply get things working and fix this later. When I reached the point where it seemed like an unncessary problem to deal with while integrating the website functionality with the popup, it was an easy decision to integrate all the user profile management into a single file/webpage for easier functionality. The website now provides a concise onboarding process, the Homepage provides easy to use features of the extension with a simple user creation experience.

## My Journey - The Project, Course And Life

My time throughout this course has had an inexplicable affect on me and I am grateful that I have been able to finish it. It has been a wonderful experience and it means so much to me personally. I've been dealing with Heart Failure (Severe Biventricular DCMP) for about 1.5 years since the age of 19. Since the day I was diagnosed, I've lost everything that I could have called mine, everything I had worked hard to achieve in my life, and barely finishing my first year of undergrad studies at Trinity College Dublin, Ireland. I won't probably be going back there, until I recover more, hopefully in another year. Life has given me a fair share problem sets, to fight to stay alive and work my way through a slow, physically tiring, painful and mentally excruciating recovery so that I wouldn't have needed a heart transplant really soon. I have made great progress and though with never-ending ups and downs, thanks to God, I have persevered through the worst times of my life without requiring a transplant, despite the bare odds of not surviving more than a week initially. I have reached a good safety point in my recovery. I am 21 now, and may I never need that transplant for a long time, touchwood, till then we got life to live.

Heart failure doesn't just affect your heart, it plays with your mind, breaks your body, tears apart your soul, your relationships and your career. Given so, I have struggled to find myself with a purpose in terms of what my career would look like. I struggled to but I fought to keep pushing my body's limits to get back to the activity levels I once used to be at, that was my major focus. Yet along with this, I've been stuck at home restrcited from going out, having no one to talk to around me, so feeling what I can't describe as anything but being defeated about my present and future was undeniable.

That's where coding came in, I wished to pursue something I was passionate about learning and that I could work on remotely. Since I've been interested in and followed everything tech my entire life, I felt it'd be great to make use of my technical yet creative mind, along with my emotionally persistent, push-through personality, it really was the perfect avenue for my time. Although I had studied computers in high school, but I chose business for my higher studies. But writing this message honestly feels like everything has lead me to this moment of time, sharing my feelings about a project I have put an exponentially large amount of time and literal blood and sweat to create. Doesn't feel like a lot when looking at the code now, but it took a lot out of me to reach this point.

My coding journey began last year with a Web Development course on freecodecamp and some more, then times when I couldn't physically do anything for as long as a month, to coming back again for more. I decided to purse Harvard's CS50 end of Feb'24 as a way to prove to myself that I'm capable of eventually becoming a programmer and potentially being at Harvard. Studying along with our amazing professor who teaches in a way I found mentally engagig and interesting even during my low mental state felt great, he makes the space give you a sense of belonging. I would look forward to his lectures, and he's certainly made my coding journey an amazing experience. The journey's been a mix of periods of long study hours for quick run throughs of the initial 4-5 weeks, to spending even more on some psets, learning extra things, to facing multiple periods of 2 weeks and an entire month (twice) when my health didn't allow me to work, to then finally coming back and spending an ungodly amount of time on the Final Project because I chose something way beyond my level, back then.

Considering my still fairly low experience, and since it being the highly esteemed Harvard's CS50, I wished to give my all for the Final Project. This feeling may not get translated well but my goal was to face my fear of not having anything left in my life to call mine, to create something concrete for myself to still have, as I had nothing, something I'd have achieved in my life, because I felt I didn't have much to show for the rest. Accordingly, I decided to take a more gain-experience based approach than creating something conceptually new, basically work that would create a strong foundation for my projects ahead. The words "Final Project" also had many heavy emotions behind it for me considering my situation, and I wanted it to be something I was proud of building.

Inspired by an extension called Teleparty, I ventured out to create my own version of it. The caveat was to to go into it blind, about everything - from being unaware of how to implement my own secure tokenised auth/login system, to browser related development, to how a real-time chat worked and the secrets behind the Netflix video player manipulation and video synchronisation mechanism. I had to figure out all that along with how Chrome Extensions were built, how I would handle exchanges video sync messages, or even what technologies were required for each thing. Although I had some experience creating web development projects for another course, this one was my biggest and first "real" complex, almost production level AND A FULL STACK project having a large amount of files working together. Understandably, I have made countless mistakes, and spent too much time getting fixated on small imperfections that I missed my initial and some later deadlines which I had set based on underwhelming guestimates of this project's difficulty (for me). I hadn't accounted for the multitude of technologies I had to learn and implement, becoming much more capable in not solely my coding knowledge but the way of analyzing and problem solving. I am a person marked with a high threshold for patience, and this project has tested me on my good days too. Looking back I can say I have learnt from the mistakes I'd make, especially in areas I lacked in such as writing cleaner/organized code and debugging. I have learnt how slow and patiently tested progress is more practical for saving precious time and consistent progress in programming, just like with my heart - programming requires one step/feature at a time while keeping others in check.

My time through this journey of pushing through life, and CS50's problem sets, and this project was truly been the learning experience of a lifetime, in every aspect possible. I'm grateful for Harvard for making CS50x available online for students like me, and I'm going to work on more courses. Thank you to Professor David J. Malan for showing me how interesting programming is and helping me reach a point where I can call myself a software developer, of sorts, maybe web developer for now? Haha, we'll see in another year's time. But thanks to you, I have come out a changed man, with a clearer purpose.

Now I know the feelings I have poured about my journey in this readme file may never be read by another person, but who cares about being embarrased talking to yourself, right? So I want to engrave this message here as a reminder for myself hoping I continue on this path and do my best to make the world a lighter place, whilst never losing sight of who I am. May this serve as a git commit of how far I have come, and maybe as a little piece of me if anything were to ever happen to me, both I guess. My love to whoever is reading this. I'm not sure if this informality is appropriate, but I hope I was able to bring a smile to someone (hope you understand and uhh, please don't flag me).

I want to say that although this README may not be acknowledged by anyone for a while, may it recognise, if it had a beating heart, the value it holds when serving this message to someone, sometime (you), when they need it to see there's always hope in life, you just have to look for it inside you and around you:)

Thank you to anyone who may have taken out the time to read this, I appreciate you.

Much love, V.
