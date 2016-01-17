:: Run ampm from its repo, assume everything is installed, and watch everything.
CD ..\..\ampm
supervisor ^
	--watch .,..\ampm-samples\cinder-test\ampm.json,..\ampm-samples\sharedState.js,restart.json ^
	--ignore .git,node_modules,view,samples,logs,app,content,state.json ^
	--extensions js,json ^
	--no-restart-on error ^
	-- server.js ..\ampm-samples\cinder-test\ampm.json dev.foo.bar
