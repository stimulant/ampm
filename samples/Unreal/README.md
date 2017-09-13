# On Windows

## To open the project
* Make sure you have Unreal v4.16 or later
* This Unreal AMPM client communicates with the AMPM server using [UE4-OSC](https://github.com/monsieurgustav/UE4-OSC). Please refer to the [github page](https://github.com/monsieurgustav/UE4-OSC) for more details. There's a [tutorial video](https://www.youtube.com/watch?v=GGGs-n-CKtY) as well as a [link to a forum](https://forums.unrealengine.com/showthread.php?49627-Plugin-OSC-for-UE4) for discussion on the plugin.
* Start Unreal. Browse and open the MyProject.uproject file (Unreal Project) from the "Source" folder

## To run the sample
* Build the project to a directory named "Build"
* Copy the file ampm.json to the "Build" directory. Edit the ampm.json file so that the "launchCommand" property holds the name of your build file.
* From a command line window navigate to the "Build" directory and run `ampm` to run in production mode, or `ampm ampm.json dev` to run in dev mode.

### Sending Heartbeat
![Alt text](https://github.com/stimulant/ampm/blob/master/samples/Unreal/Images/heart.PNG?raw=true "Sending Heartbeat Blueprint")

### Receiving Messages
![Alt text](https://github.com/stimulant/ampm/blob/master/samples/Unreal/Images/receiving.PNG?raw=true "Sending Heartbeat Blueprint")

### Logging Analytics
![Alt text](https://github.com/stimulant/ampm/blob/master/samples/Unreal/Images/analytics.PNG?raw=true "Logging Analytics Blueprint")

### Other Events
![Alt text](https://github.com/stimulant/ampm/blob/master/samples/Unreal/Images/otherevents.PNG?raw=true "Logging Other Events Blueprint")



## How to integrate AMPM with your Unreal Application:
* To integrate ampm with your app, drag and drop the Ampm script onto a Actor in your project. In the sample, the AMPM script has been added to the "Statue" object
* Build the file to a directory.
* Here's how the level blueprint looks like for sending heart beat, receiving messages, logging analytics and logging error / warning / info events.


## To start the app with AMPM
* Copy the file ampm.json to the same directory as the unity build. Edit the ampm.json file so that the "launchCommand" property holds the name of your build file. 
#### NOTE: For some reason opening the .exe from the root location of your build folder starts up two Unreal processes. This is not handled properly by ampm. In order to ensure that only a single process is launched, please set the "launchCommand" to the .exe from  BUILD_DIRECTORY\MyProject\Binaries\Win64 folder instead.
* From a command line window navigate to your build directory and run `ampm` to run in production mode, or `ampm ampm.json dev` to run in dev mode.
