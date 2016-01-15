#include "cinder/app/AppNative.h"
#include "cinder/gl/gl.h"
#include "AMPMClient.h"
#include "cinder/Json.h"

#include <map>
#include <boost/assign/list_of.hpp>
#include <boost/unordered_map.hpp>

using namespace ci;
using namespace ci::app;
using namespace std;
using boost::assign::map_list_of;

const boost::unordered_map<AMPMClient::LogEventLevel, const char*> LogEventLevelToString = map_list_of
	(AMPMClient::LogEventLevel::info,			"Informational")
	(AMPMClient::LogEventLevel::warning,		"Warning")
	(AMPMClient::LogEventLevel::error,			"Error");

AMPMClient* AMPMClient::sInstance = NULL;

AMPMClientRef AMPMClient::create( int sendPort, int recvPort )
{
	sInstance = new AMPMClient( sendPort, recvPort );
	return AMPMClientRef( sInstance );
}

AMPMClient::~AMPMClient()
{
}

AMPMClient::AMPMClient( int sendPort, int recvPort )
{
	// setup osc
	mSender.setup( "localhost", sendPort );
	mListener.setup(recvPort);
}

void AMPMClient::update()
{
	// poll messages
	while (mListener.hasWaitingMessages()) 
	{
		osc::Message message;
		mListener.getNextMessage(&message);

		if (message.getAddress() == "/config")
		{
			// do something with config if you want here
		}
	}

	// send heartbeat
	sendHeartbeat();
}

// send heartbeat to server
void AMPMClient::sendHeartbeat()
{
	osc::Message message;
	message.setAddress("heart");
	mSender.sendMessage(message);
}

// send analytics event to server
void AMPMClient::sendEvent(std::string category, std::string action, std::string label, int value)
{
	osc::Message message;
	message.setAddress("event");

	JsonTree arguments;
	arguments.pushBack( JsonTree("Category", category) );
	arguments.pushBack( JsonTree("Action", action) );
	arguments.pushBack( JsonTree("Label", label) );
	arguments.pushBack( JsonTree("Value", value) );
	message.addStringArg(arguments.serialize());
	mSender.sendMessage(message);
}

// send log event to server
void AMPMClient::log(LogEventLevel level, std::string msg, char const* line, int lineNum)
{
	osc::Message message;
	message.setAddress("log");

	JsonTree arguments;
	arguments.pushBack( JsonTree("level", LogEventLevelToString.at(level)) );
	arguments.pushBack( JsonTree("message", msg) );
	arguments.pushBack( JsonTree("line", line) );
	arguments.pushBack( JsonTree("lineNum", lineNum) );
	message.addStringArg(arguments.serialize());
	mSender.sendMessage(message);
}

// strip out file for sending as part of log info
char const * AMPMClient::getFileForLog( char const *file )
{
	return strrchr(file, '\\') ? strrchr(file, '\\') + 1 : file;
}

