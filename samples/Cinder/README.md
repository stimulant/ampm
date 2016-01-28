## ampm Cinder sample

To run this sample:

* Clone [Cinder](https://github.com/cinder/Cinder) from its Github repo.
* Create a system environment called CINDER_DIR and set it to point to Cinder's location on the disk.
* Make sure you build Cinder before building this sample.
* From the server directory, run: `npm install`
* After building this sample, run command prompt from this directory with either of the following commands:
 * `ampm` - to load the default ampm.json file and run in the default (live) mode.
 * `ampm ampm.json dev` - to load the ampm.json file, but run in dev mode.

To run this sample on a Mac:

Follow the steps above, but to start your app call `ampm ampm.json mac` to run in the default mode, or call `ampm ampm.json dev.mac` to run in dev mode.

Node that due to [App Transport Security](https://developer.apple.com/library/prerelease/ios/documentation/General/Reference/InfoPlistKeyReference/Articles/CocoaKeys.html#//apple_ref/doc/uid/TP40016240) introduced in Mac OS X 10.11 El Capitan, you'll need to add a vew lines to your project's Info.plist file warning about insecure access to localhost.

Specifically:

	<dict>
		<key>NSExceptionDomains</key>
		<dict>
			<key>localhost</key>
			<dict>
				<key>NSExceptionAllowsInsecureHTTPLoads</key>
				<true/>
			</dict>
		</dict>
	</dict>

This addition is included in the sample project, but you'll have to add it to projects created through TinderBox.