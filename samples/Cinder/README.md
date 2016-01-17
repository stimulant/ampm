Cinder AMPM Test
=========

Test Cinder app for the ampm tools.
-----------------------------------

Requirement:
- OSC Block (is part of Cinder submodule and is added to project already)

Instructions:
- Copy AMPMClient.cpp/AMPMClient.h into your project.
- Make sure you are including/building Cinder OSC block.
- Make sure you are creating new AMPMClient object in your app and calling update/log/sendEvent where appropriate.
- Copy contents of Cinder-Test folder into your project and change ampm.json to appropriate values.
- Start start.dev.bat or start.live.bat to startup AMPM (and your project).

