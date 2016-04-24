# On Windows

##To open the project
* Make sure you have Unity3D v5.3.4f1 or later
* Start Unity3D; Browse and open the Unity Project in the "Source" folder

##To run the sample
* Build the project to a directory named "Build"
* Copy the file ampm.json to the "Build" directory. Edit the ampm.json file so that the "launchCommand" property holds the name of your build file.
* From a command line window navigate to the "Build" directory and run `ampm` to run in production mode, or `ampm ampm.json dev` to run in dev mode.

## How to integrate AMPM with your Unity3D Application:
* To integrate ampm with your app, drag and drop the AmpmCommunicator.cs script onto your Main Camera or any empty Game Object.
* To use additional AMPM methods in any of your other custom classes, add the line "using AmpmLib" on top your class declaration.
* Build the file to a directory.

## To start the app with AMPM
* Copy the file ampm.json to the same directory as the unity build. Edit the ampm.json file so that the "launchCommand" property holds the name of your build file.
* From a command line window navigate to your build directory and run `ampm` to run in production mode, or `ampm ampm.json dev` to run in dev mode.
