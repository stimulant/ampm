#include "cinder/app/App.h"
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
        ( AMPMClient::LogEventLevel::info, "info" )
        ( AMPMClient::LogEventLevel::warning, "warn" )
        ( AMPMClient::LogEventLevel::error, "error" );

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
	: mSender( 10000, "127.0.0.1", sendPort ),
	  mListener( recvPort )
{
	// setup osc
	mSender.bind();

#if ! USE_UDP
	mSender.connect();
#endif

	mListener.bind();
	mListener.listen();

	mListener.setListener( "/config", [&]( const osc::Message & msg )
	{
		// do something with config here
		ci::app::console() << "hello" << std::endl;
	} );
}

void AMPMClient::update()
{
	// send heartbeat
	sendHeartbeat();
}

// send heartbeat to server
void AMPMClient::sendHeartbeat()
{
	osc::Message message;
	message.setAddress( "/heart" );
	mSender.send( message );
}

// send analytics event to server
void AMPMClient::sendEvent( std::string category, std::string action, std::string label, int value )
{
	osc::Message message;
	message.setAddress( "/event" );

	JsonTree arguments;
	arguments.pushBack( JsonTree( "Category", category ) );
	arguments.pushBack( JsonTree( "Action", action ) );
	arguments.pushBack( JsonTree( "Label", label ) );
	arguments.pushBack( JsonTree( "Value", value ) );
	message.append( arguments.serialize() );
	mSender.send( message );
}

// send log event to server
void AMPMClient::log( LogEventLevel level, std::string msg, char const* line, int lineNum )
{
	osc::Message message;
	message.setAddress( "/log" );

	JsonTree arguments;
	arguments.pushBack( JsonTree( "level", LogEventLevelToString.at( level ) ) );
	arguments.pushBack( JsonTree( "message", msg ) );
	arguments.pushBack( JsonTree( "line", line ) );
	arguments.pushBack( JsonTree( "lineNum", lineNum ) );
	message.append( arguments.serialize() );
	mSender.send( message );
}

// strip out file for sending as part of log info
char const* AMPMClient::getFileForLog( char const* file )
{
	return strrchr( file, '\\' ) ? strrchr( file, '\\' ) + 1 : file;
}

