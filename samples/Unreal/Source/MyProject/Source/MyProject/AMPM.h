// Fill out your copyright notice in the Description page of Project Settings.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Runtime/JsonUtilities/Public/JsonObjectConverter.h"
#include "AMPM.generated.h"

UENUM(BlueprintType)
enum class EventLevel : uint8
{
	Error		UMETA(DisplayName = "ERROR"),
	Warning		UMETA(DisplayName = "WARNING"),
	Info		UMETA(DisplayName = "INFO"),
};

USTRUCT(BlueprintType)
struct FAnalyticsEvent
{
	GENERATED_USTRUCT_BODY()

		UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Joy Color")
		FString Category = "";

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Joy Color")
		FString Action = "";

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Joy Color")
		FString Label = "";

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Joy Color")
		int32 Count = 0;

	FAnalyticsEvent()
	{}
};

USTRUCT(BlueprintType)
struct FLogEvent
{
	GENERATED_USTRUCT_BODY()

		UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Joy Color")
		EventLevel level = EventLevel::Info;


		UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Joy Color")
		FString message = "";

	FLogEvent()
	{}
};



UCLASS( ClassGroup=(Custom), meta=(BlueprintSpawnableComponent) )
class MYPROJECT_API UAMPM : public UActorComponent
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = AMPM)
	void GetJSONFormattedAnalyticsEvent(FAnalyticsEvent e, FString& jsonString);

	UFUNCTION(BlueprintCallable, Category = AMPM)
	void GetJSONFormattedLogEvent(FLogEvent e, FString& jsonString);

public:	
	// Sets default values for this component's properties
	UAMPM();

protected:
	// Called when the game starts
	virtual void BeginPlay() override;

public:	
	// Called every frame
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;	
};
