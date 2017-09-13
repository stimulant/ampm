# On Windows

##To open the project
* Make sure you have Unreal v4.16 or later
* This Unreal AMPM client communicates with the AMPM server using UE4-OSC. Please refer to the github page for more details, a tutorial video as well as a link to a forum for discussion on the plugin.
* Start Unreal. Browse and open the MyProject.uproject file (Unreal Project) from the "Source" folder

##To run the sample
* Build the project to a directory named "Build"
* Copy the file ampm.json to the "Build" directory. Edit the ampm.json file so that the "launchCommand" property holds the name of your build file.
* From a command line window navigate to the "Build" directory and run `ampm` to run in production mode, or `ampm ampm.json dev` to run in dev mode.

## How to integrate AMPM with your Unreal Application:
* To integrate ampm with your app, drag and drop the Ampm script onto a Actor in your project. In the sample, the AMPM script has been added to the "Statue" object
* Build the file to a directory.
* Here's how the level blueprint looks like for sending heart beat, receiving messages, logging analytics and logging error / warning / info events.

## To start the app with AMPM
* Copy the file ampm.json to the same directory as the unity build. Edit the ampm.json file so that the "launchCommand" property holds the name of your build file.
* From a command line window navigate to your build directory and run `ampm` to run in production mode, or `ampm ampm.json dev` to run in dev mode.
