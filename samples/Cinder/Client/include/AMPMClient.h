#pragma once

#include "OscSender.h"
#include "OscListener.h"

#include <queue>

typedef std::shared_ptr<class AMPMClient>				AMPMClientRef;

class AMPMClient
{
	static AMPMClient* sInstance;

	// osc connection to server
	ci::osc::Sender				mSender;
	ci::osc::Listener			mListener;

public:
	static AMPMClient* get() { return sInstance; }
	enum LogEventLevel
	{
	   info = 1,
	   error,
	   warning
	};

	static AMPMClientRef	create( int sendPort, int recvPort );
	~AMPMClient();
	void update();
	void sendEvent(std::string category = "", std::string action = "", std::string label = "", int value = 0);
	void log(LogEventLevel level, std::string msg, char const* line, int lineNum);
	static char const * getFileForLog( char const * file );

protected:
	AMPMClient( int sendPort, int recvPort );
	void sendHeartbeat();
};

// log macros (quick way to send log events to server)
#define LOG(M) AMPMClient::get()->log(AMPMClient::LogEventLevel::info, M, AMPMClient::getFileForLog(__FILE__), __LINE__)
#define LOG_ERR(M) AMPMClient::get()->log(AMPMClient::LogEventLevel::error, M, AMPMClient::getFileForLog(__FILE__), __LINE__)
#define LOG_WARN(M) AMPMClient::get()->log(AMPMClient::LogEventLevel::warning, M, AMPMClient::getFileForLog(__FILE__), __LINE__)
