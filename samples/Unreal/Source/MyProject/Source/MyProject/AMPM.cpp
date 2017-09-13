// Fill out your copyright notice in the Description page of Project Settings.

#include "AMPM.h"
#include "Runtime/JsonUtilities/Public/JsonObjectConverter.h"


// Sets default values for this component's properties
UAMPM::UAMPM()
{
	// Set this component to be initialized when the game starts, and to be ticked every frame.  You can turn these features
	// off to improve performance if you don't need them.
	PrimaryComponentTick.bCanEverTick = true;

	// ...
}


// Called when the game starts
void UAMPM::BeginPlay()
{
	Super::BeginPlay();

	// ...
	
}

void UAMPM::GetJSONFormattedAnalyticsEvent(FAnalyticsEvent e, FString& jsonString) {
	FJsonObjectConverter::UStructToJsonObjectString(FAnalyticsEvent::StaticStruct(), &e, jsonString, 0, 0);
}

void UAMPM::GetJSONFormattedLogEvent(FLogEvent e, FString& jsonString) {
	FJsonObjectConverter::UStructToJsonObjectString(FLogEvent::StaticStruct(), &e, jsonString, 0, 0);
}

// Called every frame
void UAMPM::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	// ...
}

